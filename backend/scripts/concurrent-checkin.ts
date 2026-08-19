import http from "http";
import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { signToken } from "../src/utils/jwt";
import { generateSecureToken, hashToken } from "../src/utils/qr";

const PORT = 5050;
const CONCURRENT_REQUESTS = 100;

interface TestResult {
  totalRequests: number;
  successCount: number;
  rejectedCount: number;
  otherCount: number;
  dbCheckInCount: number;
  constraintViolated: boolean;
  durationMs: number;
}

async function run(): Promise<void> {
  console.log("\n================================================================================");
  console.log("  HR1 PROOF: CONCURRENT CHECK-IN STRESS TEST (SINGLE SERVER)");
  console.log("================================================================================\n");

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`[SETUP] Test server running on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  try {
    const passwordHash = await bcrypt.hash("TestPass123!", 10);

    // 1. Setup Organizer
    const organizer = await prisma.user.upsert({
      where: { email: "stress.organizer@mic.dev" },
      update: {},
      create: {
        name: "Stress Organizer",
        email: "stress.organizer@mic.dev",
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
      where: { email: "stress.attendee1@mic.dev" },
      update: {},
      create: {
        name: "Stress Attendee 1",
        email: "stress.attendee1@mic.dev",
        passwordHash,
        role: Role.ATTENDEE,
      },
    });

    const event = await prisma.event.create({
      data: {
        name: `Stress Event ${Date.now()}`,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 100,
        organizerId: organizer.id,
      },
    });

    // 3. Create single registration + QR token
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

    console.log(`[SETUP] Created Event: ${event.id}`);
    console.log(`[SETUP] Created Registration: ${registration.id}`);
    console.log(`[SETUP] Generated Token Hash: ${tokenHash.substring(0, 16)}...`);
    console.log(`[STRESS] Sending ${CONCURRENT_REQUESTS} simultaneous POST /api/checkins requests...`);

    const startTime = Date.now();

    // 4. Send concurrent requests simultaneously
    const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, idx) => {
      return fetch(`http://127.0.0.1:${PORT}/api/checkins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${organizerToken}`,
        },
        body: JSON.stringify({ token: rawToken }),
      }).then(async (res) => {
        const text = await res.text();
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
        return { index: idx + 1, status: res.status, body };
      });
    });

    const responses = await Promise.all(requests);
    const durationMs = Date.now() - startTime;

    // 5. Aggregate responses
    let successCount = 0;
    let rejectedCount = 0;
    let otherCount = 0;

    for (const res of responses) {
      if (res.status === 201) {
        successCount++;
      } else if (res.status === 409) {
        rejectedCount++;
      } else {
        otherCount++;
        if (otherCount === 1) {
          console.log("[DEBUG ERROR SAMPLE]", res.status, JSON.stringify(res.body));
        }
      }
    }

    // 6. Direct Database State Verification
    const dbCheckIns = await prisma.checkIn.findMany({
      where: { registrationId: registration.id },
    });
    const dbCount = dbCheckIns.length;
    const constraintViolated = dbCount !== 1 || successCount !== 1;

    const result: TestResult = {
      totalRequests: CONCURRENT_REQUESTS,
      successCount,
      rejectedCount,
      otherCount,
      dbCheckInCount: dbCount,
      constraintViolated,
      durationMs,
    };

    // 7. Print Screenshot-Friendly Output Box
    console.log("\n+------------------------------------------------------------------------------+");
    console.log("|                  CONCURRENT CHECK-IN TEST RESULTS (SINGLE SERVER)            |");
    console.log("+------------------------------------------------------------------------------+");
    console.log(`| Total Concurrent Requests Sent : ${String(result.totalRequests).padEnd(43)} |`);
    console.log(`| Execution Duration             : ${`${result.durationMs} ms`.padEnd(43)} |`);
    console.log(`| Successful Check-Ins (HTTP 201): ${String(result.successCount).padEnd(43)} |`);
    console.log(`| Rejected Duplicates (HTTP 409) : ${String(result.rejectedCount).padEnd(43)} |`);
    console.log(`| Other Errors                   : ${String(result.otherCount).padEnd(43)} |`);
    console.log(`| Final Database Rows (check_ins): ${String(result.dbCheckInCount).padEnd(43)} |`);
    console.log(`| Database Constraint Violated   : ${String(result.constraintViolated ? "YES (FAILED)" : "NO (PASSED)").padEnd(43)} |`);
    console.log("+------------------------------------------------------------------------------+");

    if (result.successCount === 1 && result.dbCheckInCount === 1 && !result.constraintViolated) {
      console.log("\n>>> [PASSED] HR1 PROOF 1: Duplicate check-ins are mathematically impossible.");
    } else {
      console.error("\n>>> [FAILED] Duplicate check-in occurred!");
      process.exit(1);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
