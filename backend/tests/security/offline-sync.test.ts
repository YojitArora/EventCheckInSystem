import { Role, SyncResult } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { signToken } from "../../src/utils/jwt";
import { generateSecureToken, hashToken } from "../../src/utils/qr";

describe("HR3: Offline-First Synchronization Tests (POST /api/checkins/sync)", () => {
  const app = createApp();

  let organizer: { id: string; token: string };
  let event: { id: string };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("SyncPass123!", 10);

    const org = await prisma.user.upsert({
      where: { email: "hr3.organizer@mic.dev" },
      update: {},
      create: {
        name: "HR3 Organizer",
        email: "hr3.organizer@mic.dev",
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
        name: `Offline Sync Event ${Date.now()}`,
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        capacity: 100,
        organizerId: org.id,
      },
    });
    event = { id: ev.id };
  });

  it("Test 1: Offline scan -> successful sync", async () => {
    const attendee = await prisma.user.create({
      data: {
        name: "Offline Attendee 1",
        email: `att.offline1.${Date.now()}.${Math.random()}@mic.dev`,
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

    const clientScanId = `scan-uuid-${Date.now()}-${Math.random()}`;
    const scannedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const res = await request(app)
      .post("/api/checkins/sync")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        deviceId: "device-handheld-01",
        clientScanId,
        token: rawToken,
        scannedAt,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result).toBe(SyncResult.SUCCESS);
    expect(res.body.data.checkIn).toBeDefined();
    expect(res.body.data.syncEvent).toBeDefined();
    expect(res.body.data.syncEvent.result).toBe(SyncResult.SUCCESS);

    // Verify CheckIn and SyncEvent created in database
    const checkIn = await prisma.checkIn.findUnique({
      where: { registrationId: reg.id },
    });
    expect(checkIn).not.toBeNull();
    expect(checkIn?.source).toBe("OFFLINE_SYNC");

    const syncEvent = await prisma.syncEvent.findUnique({
      where: {
        deviceId_clientScanId: {
          deviceId: "device-handheld-01",
          clientScanId,
        },
      },
    });
    expect(syncEvent).not.toBeNull();
    expect(syncEvent?.result).toBe(SyncResult.SUCCESS);
  });

  it("Test 2: Same sync request repeated (deviceId + clientScanId same) -> idempotent single effect", async () => {
    const attendee = await prisma.user.create({
      data: {
        name: "Offline Attendee 2",
        email: `att.offline2.${Date.now()}.${Math.random()}@mic.dev`,
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

    const clientScanId = `scan-idempotent-${Date.now()}-${Math.random()}`;
    const syncPayload = {
      deviceId: "device-scanner-02",
      clientScanId,
      token: rawToken,
      scannedAt: new Date().toISOString(),
    };

    // First transmission
    const res1 = await request(app)
      .post("/api/checkins/sync")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send(syncPayload);

    expect(res1.status).toBe(201);
    expect(res1.body.data.result).toBe(SyncResult.SUCCESS);

    // Repeated transmission (network retry)
    const res2 = await request(app)
      .post("/api/checkins/sync")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send(syncPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.data.result).toBe(SyncResult.SUCCESS);
    expect(res2.body.data.isDuplicateSync).toBe(true);

    // Verify only ONE check-in row exists in DB
    const checkIns = await prisma.checkIn.findMany({
      where: { registrationId: reg.id },
    });
    expect(checkIns.length).toBe(1);

    // Verify only ONE sync event row exists in DB
    const syncEvents = await prisma.syncEvent.findMany({
      where: {
        deviceId: "device-scanner-02",
        clientScanId,
      },
    });
    expect(syncEvents.length).toBe(1);
  });

  it("Test 3: Different devices scan same QR offline -> first committed wins, second receives ALREADY_CHECKED_IN", async () => {
    const attendee = await prisma.user.create({
      data: {
        name: "Offline Attendee 3",
        email: `att.offline3.${Date.now()}.${Math.random()}@mic.dev`,
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
    const sharedToken = generateSecureToken(32);
    await prisma.qrToken.create({
      data: {
        registrationId: reg.id,
        tokenHash: hashToken(sharedToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const timestamp = Date.now();

    // Device A scans offline at t1
    const resDeviceA = await request(app)
      .post("/api/checkins/sync")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        deviceId: `device-gate-north-${timestamp}`,
        clientScanId: `scan-north-${timestamp}`,
        token: sharedToken,
        scannedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      });

    expect(resDeviceA.status).toBe(201);
    expect(resDeviceA.body.data.result).toBe(SyncResult.SUCCESS);

    // Device B syncs later for the same QR
    const resDeviceB = await request(app)
      .post("/api/checkins/sync")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        deviceId: `device-gate-south-${timestamp}`,
        clientScanId: `scan-south-${timestamp}`,
        token: sharedToken,
        scannedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      });

    expect(resDeviceB.status).toBe(200);
    expect(resDeviceB.body.data.result).toBe(SyncResult.ALREADY_CHECKED_IN);

    // Verify DB audit: 2 distinct SyncEvents recorded, but only 1 CheckIn
    const syncRecords = await prisma.syncEvent.findMany({
      where: { registrationId: reg.id },
    });
    expect(syncRecords.length).toBe(2);

    const checkIns = await prisma.checkIn.findMany({
      where: { registrationId: reg.id },
    });
    expect(checkIns.length).toBe(1);
  });

  it("Test 4: Offline scan while another device checks in online first -> ALREADY_CHECKED_IN", async () => {
    const attendee = await prisma.user.create({
      data: {
        name: "Offline Attendee 4",
        email: `att.offline4.${Date.now()}.${Math.random()}@mic.dev`,
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
    const token = generateSecureToken(32);
    await prisma.qrToken.create({
      data: {
        registrationId: reg.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 1. Online check-in happens first
    const onlineRes = await request(app)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ token });

    expect(onlineRes.status).toBe(201);

    // 2. Offline sync arrives later
    const timestamp = Date.now();
    const syncRes = await request(app)
      .post("/api/checkins/sync")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        deviceId: `device-late-sync-${timestamp}`,
        clientScanId: `scan-late-${timestamp}`,
        token,
        scannedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.data.result).toBe(SyncResult.ALREADY_CHECKED_IN);

    // DB maintains exactly 1 check-in
    const checkIns = await prisma.checkIn.findMany({
      where: { registrationId: reg.id },
    });
    expect(checkIns.length).toBe(1);
  });

  it("Test 5: Invalid token sync -> TOKEN_INVALID recorded in SyncEvent", async () => {
    const invalidToken = `invalid-token-${Date.now()}`;
    const timestamp = Date.now();

    const res = await request(app)
      .post("/api/checkins/sync")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        deviceId: `device-scanner-05-${timestamp}`,
        clientScanId: `scan-invalid-05-${timestamp}`,
        token: invalidToken,
        scannedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe(SyncResult.TOKEN_INVALID);

    // Verify failure is audited in SyncEvent table
    const syncEvent = await prisma.syncEvent.findUnique({
      where: {
        deviceId_clientScanId: {
          deviceId: `device-scanner-05-${timestamp}`,
          clientScanId: `scan-invalid-05-${timestamp}`,
        },
      },
    });
    expect(syncEvent).not.toBeNull();
    expect(syncEvent?.result).toBe(SyncResult.TOKEN_INVALID);
  });

  it("Test 6: Expired token sync -> TOKEN_EXPIRED recorded in SyncEvent", async () => {
    const attendee = await prisma.user.create({
      data: {
        name: "Offline Attendee 6",
        email: `att.offline6.${Date.now()}.${Math.random()}@mic.dev`,
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

    const timestamp = Date.now();
    const res = await request(app)
      .post("/api/checkins/sync")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        deviceId: `device-scanner-06-${timestamp}`,
        clientScanId: `scan-expired-06-${timestamp}`,
        token: expiredToken,
        scannedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe(SyncResult.TOKEN_EXPIRED);

    const syncEvent = await prisma.syncEvent.findUnique({
      where: {
        deviceId_clientScanId: {
          deviceId: `device-scanner-06-${timestamp}`,
          clientScanId: `scan-expired-06-${timestamp}`,
        },
      },
    });
    expect(syncEvent).not.toBeNull();
    expect(syncEvent?.result).toBe(SyncResult.TOKEN_EXPIRED);
  });
});
