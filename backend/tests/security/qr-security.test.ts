import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { signToken } from "../../src/utils/jwt";
import { generateSecureToken, hashToken } from "../../src/utils/qr";

describe("HR2: QR Sharing & Screenshot Abuse Protection Tests", () => {
  const app = createApp();

  let organizer: { id: string; token: string };
  let event: { id: string };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("SecPassword123!", 10);

    const org = await prisma.user.upsert({
      where: { email: "hr2.organizer@mic.dev" },
      update: {},
      create: {
        name: "HR2 Organizer",
        email: "hr2.organizer@mic.dev",
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    organizer = {
      id: org.id,
      token: signToken({ userId: org.id, email: org.email, role: Role.ORGANIZER }),
    };

    const ev = await prisma.event.create({
      data: {
        name: "Security Verification Event",
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        capacity: 100,
        organizerId: org.id,
      },
    });
    event = { id: ev.id };
  });

  it("Scenario 1 (Valid QR Token): successfully checks in on first scan", async () => {
    // Register attendee
    const attendee = await prisma.user.create({
      data: {
        name: "Attendee Valid",
        email: `att.valid.${Date.now()}@mic.dev`,
        passwordHash: "dummy",
        role: Role.ATTENDEE,
      },
    });
    const reg = await prisma.registration.create({
      data: {
        eventId: event.id,
        attendeeId: attendee.id,
      },
    });
    const rawToken = generateSecureToken(32);
    await prisma.qrToken.create({
      data: {
        registrationId: reg.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ token: rawToken });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.checkIn).toBeDefined();

    // Verify token is now marked as used in DB
    const qrRecord = await prisma.qrToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    expect(qrRecord?.usedAt).not.toBeNull();
  });

  it("Scenario 2 (Reused QR / Shared Screenshot after scan): rejects subsequent scans with 409 ALREADY_CHECKED_IN", async () => {
    // Attendee registers & gets QR
    const attendee = await prisma.user.create({
      data: {
        name: "Attendee Reused",
        email: `att.reused.${Date.now()}@mic.dev`,
        passwordHash: "dummy",
        role: Role.ATTENDEE,
      },
    });
    const reg = await prisma.registration.create({
      data: {
        eventId: event.id,
        attendeeId: attendee.id,
      },
    });
    const sharedRawToken = generateSecureToken(32);
    await prisma.qrToken.create({
      data: {
        registrationId: reg.id,
        tokenHash: hashToken(sharedRawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 1st Scan (e.g. Original Attendee)
    const firstScan = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ token: sharedRawToken });
    expect(firstScan.status).toBe(201);

    // 2nd Scan (e.g. Friend using shared screenshot)
    const secondScan = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ token: sharedRawToken });

    expect(secondScan.status).toBe(409);
    expect(secondScan.body.success).toBe(false);
    expect(secondScan.body.error.code).toBe("ALREADY_CHECKED_IN");

    // 3rd Scan (e.g. Third person trying to use same screenshot)
    const thirdScan = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ token: sharedRawToken });

    expect(thirdScan.status).toBe(409);
    expect(thirdScan.body.error.code).toBe("ALREADY_CHECKED_IN");

    // Verify DB still only has exactly 1 check-in row
    const checkIns = await prisma.checkIn.findMany({
      where: { registrationId: reg.id },
    });
    expect(checkIns.length).toBe(1);
  });

  it("Scenario 3 (Expired QR Token): rejects scan with 400 TOKEN_EXPIRED", async () => {
    const attendee = await prisma.user.create({
      data: {
        name: "Attendee Expired",
        email: `att.expired.${Date.now()}@mic.dev`,
        passwordHash: "dummy",
        role: Role.ATTENDEE,
      },
    });
    const reg = await prisma.registration.create({
      data: {
        eventId: event.id,
        attendeeId: attendee.id,
      },
    });
    const expiredToken = generateSecureToken(32);
    await prisma.qrToken.create({
      data: {
        registrationId: reg.id,
        tokenHash: hashToken(expiredToken),
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
      },
    });

    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ token: expiredToken });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("Scenario 4 (Invalid / Tampered QR Token): rejects scan with 400 TOKEN_INVALID", async () => {
    const tamperedTokens = [
      "random-non-existent-token",
      "modified-token-xyz12345",
      generateSecureToken(32), // random valid format but unknown hash
    ];

    for (const invalidToken of tamperedTokens) {
      const res = await request(app)
        .post("/api/checkins")
        .set("Authorization", `Bearer ${organizer.token}`)
        .send({ token: invalidToken });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TOKEN_INVALID");
    }
  });

  it("Scenario 5 (Stale Screenshot after Expiration Window): rejects stale screenshot with 400 TOKEN_EXPIRED", async () => {
    const attendee = await prisma.user.create({
      data: {
        name: "Attendee Stale",
        email: `att.stale.${Date.now()}@mic.dev`,
        passwordHash: "dummy",
        role: Role.ATTENDEE,
      },
    });
    const reg = await prisma.registration.create({
      data: {
        eventId: event.id,
        attendeeId: attendee.id,
      },
    });
    const staleToken = generateSecureToken(32);
    await prisma.qrToken.create({
      data: {
        registrationId: reg.id,
        tokenHash: hashToken(staleToken),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired 5 minutes ago
      },
    });

    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ token: staleToken });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });
});
