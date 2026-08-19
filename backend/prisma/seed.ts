import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

const ORGANIZER_PASSWORD = "Organizer@123";
const ATTENDEE_PASSWORD = "Attendee@123";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function main(): Promise<void> {
  console.log("Clearing existing data...");
  await prisma.syncEvent.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.qrToken.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const organizerPasswordHash = await bcrypt.hash(ORGANIZER_PASSWORD, 10);
  const attendeePasswordHash = await bcrypt.hash(ATTENDEE_PASSWORD, 10);

  console.log("Creating organizer...");
  const organizer = await prisma.user.create({
    data: {
      name: "MIC Organizer",
      email: "organizer@mic.dev",
      passwordHash: organizerPasswordHash,
      role: Role.ORGANIZER,
    },
  });

  console.log("Creating attendees...");
  const attendees = [];
  for (let i = 1; i <= 12; i++) {
    const attendee = await prisma.user.create({
      data: {
        name: `Attendee ${i}`,
        email: `attendee${i}@mic.dev`,
        passwordHash: attendeePasswordHash,
        role: Role.ATTENDEE,
      },
    });
    attendees.push(attendee);
  }

  console.log("Creating events...");
  const hackathon = await prisma.event.create({
    data: {
      name: "MIC Annual Hackathon 2026",
      date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      capacity: 10,
      organizerId: organizer.id,
    },
  });

  const networkingNight = await prisma.event.create({
    data: {
      name: "MIC Networking Night",
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      capacity: 20,
      organizerId: organizer.id,
    },
  });

  console.log("Creating registrations + QR tokens...");
  const hackathonRegistrations = [];
  for (let i = 0; i < 10; i++) {
    const registration = await prisma.registration.create({
      data: {
        eventId: hackathon.id,
        attendeeId: attendees[i]!.id,
      },
    });
    await createQrToken(registration.id, hackathon.date);
    hackathonRegistrations.push(registration);
  }

  const networkingRegistrations = [];
  for (let i = 0; i < 8; i++) {
    const registration = await prisma.registration.create({
      data: {
        eventId: networkingNight.id,
        attendeeId: attendees[i]!.id,
      },
    });
    await createQrToken(registration.id, networkingNight.date);
    networkingRegistrations.push(registration);
  }

  console.log("Creating check-ins (sample data)...");
  for (let i = 0; i < 6; i++) {
    await prisma.checkIn.create({
      data: {
        registrationId: hackathonRegistrations[i]!.id,
        checkedInAt: new Date(Date.now() - (i + 1) * 15 * 60 * 1000),
        source: i % 2 === 0 ? "ONLINE" : "OFFLINE_SYNC",
      },
    });
  }

  console.log("Seeding complete.");
  console.log("----------------------------------------");
  console.log("Organizer login:  organizer@mic.dev / Organizer@123");
  console.log("Attendee login:   attendee1@mic.dev  / Attendee@123");
  console.log("Events:           2, Registrations: 18, Check-ins: 6");
}

async function createQrToken(registrationId: string, eventDate: Date): Promise<void> {
  const rawToken = randomBytes(32).toString("base64url");
  await prisma.qrToken.create({
    data: {
      registrationId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(eventDate.getTime() + 4 * 60 * 60 * 1000),
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());