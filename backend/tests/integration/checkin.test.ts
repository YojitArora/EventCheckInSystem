import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { signToken } from "../../src/utils/jwt";
import { generateSecureToken, hashToken } from "../../src/utils/qr";

describe("Check-In API (POST /api/checkins)", () => {
  const app = createApp();

  let organizerA: { id: string; token: string };
  let organizerB: { id: string; token: string };
  let attendee1: { id: string; token: string };
  let attendee2: { id: string; token: string };
  let eventA: { id: string };
  let validRawToken: string;
  let expiredRawToken: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Create Organizer A
    const orgA = await prisma.user.upsert({
      where: { email: "checkin.orgA@mic.dev" },
      update: {},
      create: {
        name: "Checkin Organizer A",
        email: "checkin.orgA@mic.dev",
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    organizerA = {
      id: orgA.id,
      token: signToken({ userId: orgA.id, email: orgA.email, role: Role.ORGANIZER }),
    };

    // Create Organizer B
    const orgB = await prisma.user.upsert({
      where: { email: "checkin.orgB@mic.dev" },
      update: {},
      create: {
        name: "Checkin Organizer B",
        email: "checkin.orgB@mic.dev",
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    organizerB = {
      id: orgB.id,
      token: signToken({ userId: orgB.id, email: orgB.email, role: Role.ORGANIZER }),
    };

    // Create Attendees
    const att1 = await prisma.user.upsert({
      where: { email: "checkin.att1@mic.dev" },
      update: {},
      create: {
        name: "Checkin Attendee 1",
        email: "checkin.att1@mic.dev",
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    attendee1 = {
      id: att1.id,
      token: signToken({ userId: att1.id, email: att1.email, role: Role.ATTENDEE }),
    };

    const att2 = await prisma.user.upsert({
      where: { email: "checkin.att2@mic.dev" },
      update: {},
      create: {
        name: "Checkin Attendee 2",
        email: "checkin.att2@mic.dev",
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    attendee2 = {
      id: att2.id,
      token: signToken({ userId: att2.id, email: att2.email, role: Role.ATTENDEE }),
    };

    // Create Event under Organizer A
    const event = await prisma.event.create({
      data: {
        name: "Checkin Verification Gala",
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        capacity: 100,
        organizerId: organizerA.id,
      },
    });
    eventA = { id: event.id };

    // Register Attendee 1 via API to obtain a valid QR token
    const regRes = await request(app)
      .post(`/api/events/${eventA.id}/register`)
      .set("Authorization", `Bearer ${attendee1.token}`);

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.registration.ticket).toBeDefined();
    validRawToken = regRes.body.data.registration.ticket.token;

    // Verify DB stores ONLY token_hash and NOT raw QR token
    const storedQr = await prisma.qrToken.findUnique({
      where: { registrationId: regRes.body.data.registration.id },
    });
    expect(storedQr).toBeDefined();
    expect(storedQr!.tokenHash).toBe(hashToken(validRawToken));
    expect(storedQr!.tokenHash).not.toBe(validRawToken);

    // Register Attendee 2 and manually set an expired token
    const reg2 = await prisma.registration.create({
      data: {
        eventId: eventA.id,
        attendeeId: attendee2.id,
      },
    });
    expiredRawToken = generateSecureToken(32);
    await prisma.qrToken.create({
      data: {
        registrationId: reg2.id,
        tokenHash: hashToken(expiredRawToken),
        expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours in the past
      },
    });
  });

  it("successfully checks in an attendee with a valid QR token", async () => {
    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizerA.token}`)
      .send({ token: validRawToken });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Check-in successful");
    expect(res.body.data.checkIn).toBeDefined();
    expect(res.body.data.checkIn.source).toBe("ONLINE");
    expect(res.body.data.attendee.email).toBe("checkin.att1@mic.dev");
    expect(res.body.data.event.id).toBe(eventA.id);

    // Verify QR token is now marked as used in DB
    const qrRecord = await prisma.qrToken.findUnique({
      where: { tokenHash: hashToken(validRawToken) },
    });
    expect(qrRecord!.usedAt).not.toBeNull();
  });

  it("rejects duplicate check-in with the same used token (409 ALREADY_CHECKED_IN)", async () => {
    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizerA.token}`)
      .send({ token: validRawToken });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ALREADY_CHECKED_IN");
  });

  it("rejects check-in with an invalid/non-existent QR token (400 TOKEN_INVALID)", async () => {
    const fakeToken = "invalid-non-existent-token-xyz123";
    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizerA.token}`)
      .send({ token: fakeToken });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });

  it("rejects check-in with an expired QR token (400 TOKEN_EXPIRED)", async () => {
    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizerA.token}`)
      .send({ token: expiredRawToken });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("rejects check-in attempt by an ATTENDEE (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${attendee1.token}`)
      .send({ token: validRawToken });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects check-in attempt without authentication (401 Unauthorized)", async () => {
    const res = await request(app)
      .post("/api/checkins")
      .send({ token: validRawToken });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects check-in attempt by an organizer who does not own the event (403 Forbidden)", async () => {
    // Create a new fresh registration under eventA (Organizer A)
    const freshEmail = `fresh.${Date.now()}.${Math.random()}@mic.dev`;
    const freshAtt = await prisma.user.create({
      data: {
        name: "Fresh Attendee",
        email: freshEmail,
        passwordHash: "dummy",
        role: Role.ATTENDEE,
      },
    });
    const freshToken = generateSecureToken(32);
    const reg = await prisma.registration.create({
      data: {
        eventId: eventA.id,
        attendeeId: freshAtt.id,
      },
    });
    await prisma.qrToken.create({
      data: {
        registrationId: reg.id,
        tokenHash: hashToken(freshToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Organizer B tries to check in attendee for Organizer A's event
    const res = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizerB.token}`)
      .send({ token: freshToken });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
