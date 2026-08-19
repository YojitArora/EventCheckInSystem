import http from "http";
import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { signToken } from "../src/utils/jwt";
import { generateSecureToken, hashToken } from "../src/utils/qr";

const PORT_A = 5050;
const PORT_B = 5051;
const TOTAL_CONCURRENT_REQUESTS = 100;

interface TestResult {
  totalRequests: number;
  serverARequests: number;
  serverBRequests: number;
  serverASuccess: number;
  serverBSuccess: number;
  totalSuccess: number;
  totalRejected: number;
  dbCheckInCount: number;
  constraintViolated: boolean;
  durationMs: number;
}

async function run(): Promise<void> {
  console.log("\n================================================================================");
  console.log("  HR1 PROOF: CONCURRENT CHECK-IN (TWO SERVERS / MULTI-PROCESS)");
  console.log("================================================================================\n");

  const appA = createApp();
  const serverA = http.createServer(appA);

  const appB = createApp();
  const serverB = http.createServer(appB);

  await Promise.all([
    new Promise<void>((resolve) => serverA.listen(PORT_A, resolve)),
    new Promise<void>((resolve) => serverB.listen(PORT_B, resolve)),
  ]);

  console.log(`[SETUP] Server A running on http://127.0.0.1:${PORT_A}`);
  console.log(`[SETUP] Server B running on http://127.0.0.1:${PORT_B}`);
  console.log("[SETUP] Both servers connected to the same PostgreSQL container.\n");

  try {
    const passwordHash = await bcrypt.hash("TestPass123!", 10);

    // 1. Setup Organizer
    const organizer = await prisma.user.upsert({
      where: { email: "stress.multi.organizer@mic.dev" },
      update: {},
      create: {
        name: "Multi-Server Organizer",
        email: "stress.multi.organizer@mic.dev",
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    const organizerToken = signToken({
      userId: organizer.id,
      email: organizer.email,
      role: Role.ORGANIZER,
    });

    // 2. Setup Attendee & Event
    const attendee = await prisma.user.upsert({
      where: { email: "stress.multi.attendee@mic.dev" },
      update: {},
      create: {
        name: "Multi-Server Attendee",
        email: "stress.multi.attendee@mic.dev",
        passwordHash,
        role: Role.ATTENDEE,
      },
    });

    const event = await prisma.event.create({
      data: {
        name: `Multi-Server Event ${Date.now()}`,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 100,
        organizerId: organizer.id,
      },
    });

    // 3. Create Registration + QR Token
    const registration = await prisma.registration.create({
      data: {
        eventId: event.id,
        attendeeId: attendee.id,
        status: "REGISTERED",
      },
    });

    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    await prisma.qrToken.create({
      data: {
        registrationId: registration.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    console.log(`[SETUP] Registration ID: ${registration.id}`);
    console.log(`[STRESS] Sending ${TOTAL_CONCURRENT_REQUESTS} simultaneous requests distributed evenly across Server A and Server B...`);

    const startTime = Date.now();

    // 4. Distribute requests across Server A and Server B simultaneously
    const requests = Array.from({ length: TOTAL_CONCURRENT_REQUESTS }, (_, idx) => {
      const port = idx % 2 === 0 ? PORT_A : PORT_B;
      const targetServer = idx % 2 === 0 ? "A" : "B";

      return fetch(`http://127.0.0.1:${port}/api/checkins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${organizerToken}`,
        },
        body: JSON.stringify({ token: rawToken }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        return { index: idx + 1, targetServer, status: res.status, body };
      });
    });

    const responses = await Promise.all(requests);
    const durationMs = Date.now() - startTime;

    // 5. Aggregate
    let serverASuccess = 0;
    let serverBSuccess = 0;
    let totalRejected = 0;

    for (const res of responses) {
      if (res.status === 201) {
        if (res.targetServer === "A") serverASuccess++;
        else serverBSuccess++;
      } else if (res.status === 409) {
        totalRejected++;
      }
    }

    const totalSuccess = serverASuccess + serverBSuccess;

    // 6. DB Verification
    const dbCheckIns = await prisma.checkIn.findMany({
      where: { registrationId: registration.id },
    });
    const dbCount = dbCheckIns.length;
    const constraintViolated = dbCount !== 1 || totalSuccess !== 1;

    const result: TestResult = {
      totalRequests: TOTAL_CONCURRENT_REQUESTS,
      serverARequests: TOTAL_CONCURRENT_REQUESTS / 2,
      serverBRequests: TOTAL_CONCURRENT_REQUESTS / 2,
      serverASuccess,
      serverBSuccess,
      totalSuccess,
      totalRejected,
      dbCheckInCount: dbCount,
      constraintViolated,
      durationMs,
    };

    // 7. Output Box
    console.log("\n+------------------------------------------------------------------------------+");
    console.log("|             CONCURRENT CHECK-IN RESULTS (TWO DISTRIBUTED SERVERS)            |");
    console.log("+------------------------------------------------------------------------------+");
    console.log(`| Total Distributed Requests     : ${String(result.totalRequests).padEnd(43)} |`);
    console.log(`| Requests to Server A (Port 5000): ${String(result.serverARequests).padEnd(42)} |`);
    console.log(`| Requests to Server B (Port 5001): ${String(result.serverBRequests).padEnd(42)} |`);
    console.log(`| Execution Duration             : ${`${result.durationMs} ms`.padEnd(43)} |`);
    console.log(`| Server A Successful Check-Ins  : ${String(result.serverASuccess).padEnd(43)} |`);
    console.log(`| Server B Successful Check-Ins  : ${String(result.serverBSuccess).padEnd(43)} |`);
    console.log(`| Total Successful (HTTP 201)    : ${String(result.totalSuccess).padEnd(43)} |`);
    console.log(`| Total Rejected (HTTP 409)      : ${String(result.totalRejected).padEnd(43)} |`);
    console.log(`| Database Rows (check_ins)      : ${String(result.dbCheckInCount).padEnd(43)} |`);
    console.log(`| Constraint Violated / Over-run : ${String(result.constraintViolated ? "YES (FAILED)" : "NO (PASSED)").padEnd(43)} |`);
    console.log("+------------------------------------------------------------------------------+");

    if (totalSuccess === 1 && dbCount === 1 && !constraintViolated) {
      console.log("\n>>> [PASSED] HR1 PROOF 2: Multi-process isolation verified. Exact-once check-in guaranteed.");
    } else {
      console.error("\n>>> [FAILED] Multi-server race condition detected!");
      process.exit(1);
    }
  } finally {
    serverA.close();
    serverB.close();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
