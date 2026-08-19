import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { signToken } from "../../src/utils/jwt";

describe("Event Registration API (POST /api/events/:eventId/register)", () => {
  const app = createApp();

  let organizer: { id: string; token: string };
  let attendeeA: { id: string; token: string };
  let attendeeB: { id: string; token: string };
  let attendeeC: { id: string; token: string };
  let limitedEvent: { id: string };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const org = await prisma.user.upsert({
      where: { email: "reg.organizer@mic.dev" },
      update: {},
      create: {
        name: "Reg Organizer",
        email: "reg.organizer@mic.dev",
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    organizer = {
      id: org.id,
      token: signToken({ userId: org.id, email: org.email, role: Role.ORGANIZER }),
    };

    const attA = await prisma.user.upsert({
      where: { email: "reg.attA@mic.dev" },
      update: {},
      create: {
        name: "Attendee A",
        email: "reg.attA@mic.dev",
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    attendeeA = {
      id: attA.id,
      token: signToken({ userId: attA.id, email: attA.email, role: Role.ATTENDEE }),
    };

    const attB = await prisma.user.upsert({
      where: { email: "reg.attB@mic.dev" },
      update: {},
      create: {
        name: "Attendee B",
        email: "reg.attB@mic.dev",
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    attendeeB = {
      id: attB.id,
      token: signToken({ userId: attB.id, email: attB.email, role: Role.ATTENDEE }),
    };

    const attC = await prisma.user.upsert({
      where: { email: "reg.attC@mic.dev" },
      update: {},
      create: {
        name: "Attendee C",
        email: "reg.attC@mic.dev",
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    attendeeC = {
      id: attC.id,
      token: signToken({ userId: attC.id, email: attC.email, role: Role.ATTENDEE }),
    };

    // Create an event with capacity = 2
    const event = await prisma.event.create({
      data: {
        name: "Limited Capacity Workshop",
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        capacity: 2,
        organizerId: organizer.id,
      },
    });
    limitedEvent = { id: event.id };
  });

  it("allows an ATTENDEE to successfully register for an event", async () => {
    const res = await request(app)
      .post(`/api/events/${limitedEvent.id}/register`)
      .set("Authorization", `Bearer ${attendeeA.token}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.registration.eventId).toBe(limitedEvent.id);
    expect(res.body.data.registration.attendeeId).toBe(attendeeA.id);
    expect(res.body.data.registration.status).toBe("REGISTERED");
  });

  it("rejects duplicate registration attempt by the same attendee with 409 Conflict", async () => {
    const res = await request(app)
      .post(`/api/events/${limitedEvent.id}/register`)
      .set("Authorization", `Bearer ${attendeeA.token}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ALREADY_REGISTERED");
  });

  it("rejects registration attempt by an ORGANIZER with 403 Forbidden", async () => {
    const res = await request(app)
      .post(`/api/events/${limitedEvent.id}/register`)
      .set("Authorization", `Bearer ${organizer.token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects unauthenticated registration attempt with 401 Unauthorized", async () => {
    const res = await request(app).post(`/api/events/${limitedEvent.id}/register`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects registration when event capacity is reached (EVENT_FULL)", async () => {
    // Fill the 2nd slot (capacity = 2)
    const resB = await request(app)
      .post(`/api/events/${limitedEvent.id}/register`)
      .set("Authorization", `Bearer ${attendeeB.token}`);

    expect(resB.status).toBe(201);
    expect(resB.body.success).toBe(true);

    // 3rd attendee attempts to register for full event
    const resC = await request(app)
      .post(`/api/events/${limitedEvent.id}/register`)
      .set("Authorization", `Bearer ${attendeeC.token}`);

    expect(resC.status).toBe(409);
    expect(resC.body.success).toBe(false);
    expect(resC.body.error.code).toBe("EVENT_FULL");
  });

  it("returns 404 when registering for a non-existent event", async () => {
    const fakeEventId = "11111111-1111-1111-1111-111111111111";
    const res = await request(app)
      .post(`/api/events/${fakeEventId}/register`)
      .set("Authorization", `Bearer ${attendeeC.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
