import { CheckInSource, RegistrationStatus, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { signToken } from "../../src/utils/jwt";

describe("Organizer dashboard and attendee CSV export", () => {
  const app = createApp();
  let organizerToken: string;
  let otherOrganizerToken: string;
  let eventId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = `${Date.now()}-${Math.random()}`;
    const organizer = await prisma.user.create({
      data: { name: "Dashboard Owner", email: `dashboard-owner-${suffix}@mic.dev`, passwordHash, role: Role.ORGANIZER },
    });
    const otherOrganizer = await prisma.user.create({
      data: { name: "Other Organizer", email: `dashboard-other-${suffix}@mic.dev`, passwordHash, role: Role.ORGANIZER },
    });
    organizerToken = signToken({ userId: organizer.id, email: organizer.email, role: organizer.role });
    otherOrganizerToken = signToken({ userId: otherOrganizer.id, email: otherOrganizer.email, role: otherOrganizer.role });
    const event = await prisma.event.create({
      data: { name: "Dashboard Event", date: new Date("2030-01-01T10:00:00.000Z"), capacity: 10, organizerId: organizer.id },
    });
    eventId = event.id;

    const attendees = await Promise.all(
      ["Checked In", "No Show", "Cancelled"].map((name, index) =>
        prisma.user.create({
          data: { name, email: `dashboard-attendee-${index}-${suffix}@mic.dev`, passwordHash, role: Role.ATTENDEE },
        })
      )
    );
    const checkedInRegistration = await prisma.registration.create({
      data: { eventId, attendeeId: attendees[0].id },
    });
    await prisma.checkIn.create({
      data: {
        registrationId: checkedInRegistration.id,
        checkedInAt: new Date("2030-01-01T09:15:00.000Z"),
        source: CheckInSource.ONLINE,
      },
    });
    await prisma.registration.create({ data: { eventId, attendeeId: attendees[1].id } });
    await prisma.registration.create({
      data: { eventId, attendeeId: attendees[2].id, status: RegistrationStatus.CANCELLED },
    });
  });

  it("calculates database-backed counts, percentage, no-shows, and peak time", async () => {
    const response = await request(app)
      .get(`/api/events/${eventId}/dashboard`)
      .set("Authorization", `Bearer ${organizerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.dashboard).toMatchObject({
      totalCapacity: 10,
      totalRegisteredAttendees: 2,
      checkedInCount: 1,
      remainingCapacity: 8,
      noShows: 1,
      attendancePercentage: 50,
      peakCheckInTime: { hour: "09:00 UTC", count: 1 },
    });
  });

  it("exports the required attendee columns and values", async () => {
    const response = await request(app)
      .get(`/api/events/${eventId}/export`)
      .set("Authorization", `Bearer ${organizerToken}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("attendee name,attendee email,registration status,registration timestamp,check-in status,check-in timestamp");
    expect(response.text).toContain('"Checked In"');
    expect(response.text).toContain('"CHECKED_IN"');
    expect(response.text).toContain('"No Show"');
    expect(response.text).toContain('"NOT_CHECKED_IN"');
  });

  it("requires an organizer and verifies event ownership", async () => {
    const unauthorized = await request(app).get(`/api/events/${eventId}/export`);
    expect(unauthorized.status).toBe(401);

    const forbidden = await request(app)
      .get(`/api/events/${eventId}/export`)
      .set("Authorization", `Bearer ${otherOrganizerToken}`);
    expect(forbidden.status).toBe(403);

    const dashboardForbidden = await request(app)
      .get(`/api/events/${eventId}/dashboard`)
      .set("Authorization", `Bearer ${otherOrganizerToken}`);
    expect(dashboardForbidden.status).toBe(403);
  });
});
