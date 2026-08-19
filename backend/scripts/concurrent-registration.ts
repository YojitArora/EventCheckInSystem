import http from "http";
import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { signToken } from "../src/utils/jwt";

const PORT = 5050;
const EVENT_CAPACITY = 50;
const TOTAL_APPLICANTS = 100;

interface TestResult {
  eventCapacity: number;
  totalApplicants: number;
  successfulRegistrations: number;
  rejectedRegistrations: number;
  otherErrors: number;
  finalDbRegistrationCount: number;
  capacityExceeded: boolean;
  durationMs: number;
}

async function run(): Promise<void> {
  console.log("\n================================================================================");
  console.log("  HR1 PROOF: CONCURRENT REGISTRATION CAPACITY PROOF");
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
    const passwordHash = await bcrypt.hash("Pass1234!", 10);

    // 1. Create Organizer
    const organizer = await prisma.user.upsert({
      where: { email: "reg.stress.organizer@mic.dev" },
      update: {},
      create: {
        name: "Registration Stress Organizer",
        email: "reg.stress.organizer@mic.dev",
        passwordHash,
        role: Role.ORGANIZER,
      },
    });

    // 2. Create Event with fixed capacity = 50
    const event = await prisma.event.create({
      data: {
        name: `Capacity Proof Event ${Date.now()}`,
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        capacity: EVENT_CAPACITY,
        organizerId: organizer.id,
      },
    });

    console.log(`[SETUP] Created Event '${event.name}' with STRICT CAPACITY: ${EVENT_CAPACITY}`);
    console.log(`[SETUP] Pre-generating ${TOTAL_APPLICANTS} unique attendee credentials...`);

    // 3. Batch create distinct attendees + generate their auth tokens
    const attendees = [];
    const timestamp = Date.now();

    for (let i = 1; i <= TOTAL_APPLICANTS; i++) {
      const email = `applicant.${timestamp}.${i}@mic.dev`;
      const user = await prisma.user.create({
        data: {
          name: `Applicant ${i}`,
          email,
          passwordHash,
          role: Role.ATTENDEE,
        },
      });

      const token = signToken({
        userId: user.id,
        email: user.email,
        role: Role.ATTENDEE,
      });

      attendees.push({ user, token });
    }

    console.log(`[STRESS] Firing ${TOTAL_APPLICANTS} simultaneous registration requests for ${EVENT_CAPACITY} available slots...`);

    const startTime = Date.now();

    // 4. Send all registration requests concurrently
    const requests = attendees.map(({ token }, idx) => {
      return fetch(`http://127.0.0.1:${PORT}/api/events/${event.id}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        return { index: idx + 1, status: res.status, body };
      });
    });

    const responses = await Promise.all(requests);
    const durationMs = Date.now() - startTime;

    // 5. Aggregate responses
    let successfulRegistrations = 0;
    let rejectedRegistrations = 0;
    let otherErrors = 0;

    for (const res of responses) {
      if (res.status === 201) {
        successfulRegistrations++;
      } else if (res.status === 409 && (res.body as any)?.error?.code === "EVENT_FULL") {
        rejectedRegistrations++;
      } else {
        otherErrors++;
      }
    }

    // 6. Direct Database Count Verification
    const finalDbRegistrationCount = await prisma.registration.count({
      where: {
        eventId: event.id,
        status: "REGISTERED",
      },
    });

    const capacityExceeded = finalDbRegistrationCount > EVENT_CAPACITY || successfulRegistrations > EVENT_CAPACITY;

    const result: TestResult = {
      eventCapacity: EVENT_CAPACITY,
      totalApplicants: TOTAL_APPLICANTS,
      successfulRegistrations,
      rejectedRegistrations,
      otherErrors,
      finalDbRegistrationCount,
      capacityExceeded,
      durationMs,
    };

    // 7. Print Output Box
    console.log("\n+------------------------------------------------------------------------------+");
    console.log("|               CONCURRENT REGISTRATION CAPACITY PROOF RESULTS                 |");
    console.log("+------------------------------------------------------------------------------+");
    console.log(`| Target Event Capacity          : ${String(result.eventCapacity).padEnd(43)} |`);
    console.log(`| Total Competing Applicants     : ${String(result.totalApplicants).padEnd(43)} |`);
    console.log(`| Execution Duration             : ${`${result.durationMs} ms`.padEnd(43)} |`);
    console.log(`| Accepted Registrations (201)   : ${String(result.successfulRegistrations).padEnd(43)} |`);
    console.log(`| Rejected Overflow (409 FULL)   : ${String(result.rejectedRegistrations).padEnd(43)} |`);
    console.log(`| Other Errors                   : ${String(result.otherErrors).padEnd(43)} |`);
    console.log(`| Final Database Rows in Table   : ${String(result.finalDbRegistrationCount).padEnd(43)} |`);
    console.log(`| Event Over-subscribed / Broken : ${String(result.capacityExceeded ? "YES (FAILED)" : "NO (PASSED)").padEnd(43)} |`);
    console.log("+------------------------------------------------------------------------------+");

    if (
      result.successfulRegistrations === EVENT_CAPACITY &&
      result.finalDbRegistrationCount === EVENT_CAPACITY &&
      result.rejectedRegistrations === (TOTAL_APPLICANTS - EVENT_CAPACITY) &&
      !result.capacityExceeded
    ) {
      console.log("\n>>> [PASSED] HR1 PROOF 3: Event capacity is strictly preserved under extreme concurrency.");
    } else {
      console.error("\n>>> [FAILED] Capacity overrun or inconsistency detected!");
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
