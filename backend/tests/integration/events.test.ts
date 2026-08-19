import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { signToken } from "../../src/utils/jwt";

describe("Event Management API (/api/events)", () => {
  const app = createApp();

  let organizerA: { id: string; email: string; token: string };
  let organizerB: { id: string; email: string; token: string };
  let attendee: { id: string; email: string; token: string };
  let eventA: { id: string; name: string };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Create Organizer A
    const orgA = await prisma.user.upsert({
      where: { email: "orgA@mic.dev" },
      update: {},
      create: {
        name: "Organizer A",
        email: "orgA@mic.dev",
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    organizerA = {
      id: orgA.id,
      email: orgA.email,
      token: signToken({ userId: orgA.id, email: orgA.email, role: Role.ORGANIZER }),
    };

    // Create Organizer B
    const orgB = await prisma.user.upsert({
      where: { email: "orgB@mic.dev" },
      update: {},
      create: {
        name: "Organizer B",
        email: "orgB@mic.dev",
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    organizerB = {
      id: orgB.id,
      email: orgB.email,
      token: signToken({ userId: orgB.id, email: orgB.email, role: Role.ORGANIZER }),
    };

    // Create Attendee
    const att = await prisma.user.upsert({
      where: { email: "event.attendee@mic.dev" },
      update: {},
      create: {
        name: "Event Attendee",
        email: "event.attendee@mic.dev",
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    attendee = {
      id: att.id,
      email: att.email,
      token: signToken({ userId: att.id, email: att.email, role: Role.ATTENDEE }),
    };
  });

  describe("POST /api/events", () => {
    it("allows ORGANIZER to create an event", async () => {
      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${organizerA.token}`)
        .send({
          name: "Annual Conference 2026",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          capacity: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.name).toBe("Annual Conference 2026");
      expect(res.body.data.event.capacity).toBe(50);
      expect(res.body.data.event.organizerId).toBe(organizerA.id);

      eventA = res.body.data.event;
    });

    it("rejects event creation by an ATTENDEE with 403 Forbidden", async () => {
      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${attendee.token}`)
        .send({
          name: "Unauthorized Event",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          capacity: 20,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects event creation without token with 401 Unauthorized", async () => {
      const res = await request(app).post("/api/events").send({
        name: "Anonymous Event",
        date: new Date().toISOString(),
        capacity: 10,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects invalid payload (negative capacity)", async () => {
      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${organizerA.token}`)
        .send({
          name: "Invalid Event",
          date: new Date().toISOString(),
          capacity: -5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/events and GET /api/events/:eventId", () => {
    it("lists events", async () => {
      const res = await request(app).get("/api/events");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.events)).toBe(true);
      expect(res.body.data.events.length).toBeGreaterThan(0);
    });

    it("retrieves a single event by ID", async () => {
      const res = await request(app).get(`/api/events/${eventA.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.id).toBe(eventA.id);
      expect(res.body.data.event.organizer).toBeDefined();
    });

    it("returns 404 for non-existent event", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await request(app).get(`/api/events/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/events/:eventId", () => {
    it("allows organizer to update their own event", async () => {
      const res = await request(app)
        .patch(`/api/events/${eventA.id}`)
        .set("Authorization", `Bearer ${organizerA.token}`)
        .send({
          name: "Updated Annual Conference 2026",
          capacity: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.name).toBe("Updated Annual Conference 2026");
      expect(res.body.data.event.capacity).toBe(100);
    });

    it("rejects update attempt by another organizer (Organizer B) with 403 Forbidden", async () => {
      const res = await request(app)
        .patch(`/api/events/${eventA.id}`)
        .set("Authorization", `Bearer ${organizerB.token}`)
        .send({
          name: "Hacked Event Name",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects update attempt by an attendee with 403 Forbidden", async () => {
      const res = await request(app)
        .patch(`/api/events/${eventA.id}`)
        .set("Authorization", `Bearer ${attendee.token}`)
        .send({
          name: "Attendee Attempt",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/events/:eventId", () => {
    let eventToDelete: { id: string };

    beforeAll(async () => {
      const event = await prisma.event.create({
        data: {
          name: "Event To Delete",
          date: new Date(),
          capacity: 10,
          organizerId: organizerA.id,
        },
      });
      eventToDelete = event;
    });

    it("rejects delete attempt by another organizer (Organizer B) with 403 Forbidden", async () => {
      const res = await request(app)
        .delete(`/api/events/${eventToDelete.id}`)
        .set("Authorization", `Bearer ${organizerB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects delete attempt by an attendee with 403 Forbidden", async () => {
      const res = await request(app)
        .delete(`/api/events/${eventToDelete.id}`)
        .set("Authorization", `Bearer ${attendee.token}`);

      expect(res.status).toBe(403);
    });

    it("allows the owning organizer to delete the event", async () => {
      const res = await request(app)
        .delete(`/api/events/${eventToDelete.id}`)
        .set("Authorization", `Bearer ${organizerA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const checkRes = await request(app).get(`/api/events/${eventToDelete.id}`);
      expect(checkRes.status).toBe(404);
    });
  });
});
