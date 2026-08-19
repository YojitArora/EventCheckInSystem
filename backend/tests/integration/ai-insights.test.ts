import { CheckInSource, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { AIProvider } from "../../src/services/ai/ai.provider";
import { aiService } from "../../src/services/ai/ai.service";
import { signToken } from "../../src/utils/jwt";

describe("HR4: AI Event Insights (POST /api/ai/insights)", () => {
  const app = createApp();

  let organizerToken: string;
  let otherOrganizerToken: string;
  let attendeeToken: string;
  let eventId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = `${Date.now()}-${Math.random()}`;

    // 1. Create main Organizer
    const organizer = await prisma.user.create({
      data: {
        name: "AI Insights Organizer",
        email: `ai-org-${suffix}@mic.dev`,
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    organizerToken = signToken({
      userId: organizer.id,
      email: organizer.email,
      role: organizer.role,
    });

    // 2. Create another Organizer
    const otherOrganizer = await prisma.user.create({
      data: {
        name: "Other Organizer",
        email: `other-org-${suffix}@mic.dev`,
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    otherOrganizerToken = signToken({
      userId: otherOrganizer.id,
      email: otherOrganizer.email,
      role: otherOrganizer.role,
    });

    // 3. Create an Attendee
    const attendee = await prisma.user.create({
      data: {
        name: "AI Attendee",
        email: `ai-attendee-${suffix}@mic.dev`,
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    attendeeToken = signToken({
      userId: attendee.id,
      email: attendee.email,
      role: attendee.role,
    });

    // 4. Create an Event with attendees & check-ins
    const event = await prisma.event.create({
      data: {
        name: "Tech Summit 2030",
        date: new Date("2030-06-15T09:00:00.000Z"),
        capacity: 100,
        organizerId: organizer.id,
      },
    });
    eventId = event.id;

    // Create 3 attendees (2 checked in, 1 no-show)
    const registeredUsers = await Promise.all(
      [1, 2, 3].map((i) =>
        prisma.user.create({
          data: {
            name: `Summit Attendee ${i}`,
            email: `summit-${i}-${suffix}@mic.dev`,
            passwordHash,
            role: Role.ATTENDEE,
          },
        })
      )
    );

    const reg1 = await prisma.registration.create({
      data: { eventId, attendeeId: registeredUsers[0].id },
    });
    const reg2 = await prisma.registration.create({
      data: { eventId, attendeeId: registeredUsers[1].id },
    });
    await prisma.registration.create({
      data: { eventId, attendeeId: registeredUsers[2].id },
    });

    await prisma.checkIn.create({
      data: {
        registrationId: reg1.id,
        checkedInAt: new Date("2030-06-15T08:45:00.000Z"),
        source: CheckInSource.ONLINE,
      },
    });

    await prisma.checkIn.create({
      data: {
        registrationId: reg2.id,
        checkedInAt: new Date("2030-06-15T08:50:00.000Z"),
        source: CheckInSource.ONLINE,
      },
    });
  });

  afterEach(() => {
    // Reset any custom provider mocks back to default
    vi.restoreAllMocks();
  });

  // 1. Successful AI response
  it("1. returns authoritative statistics and Gemini explanation for valid organizer request", async () => {
    const mockProvider: AIProvider = {
      name: "gemini",
      generateInsight: vi.fn().mockResolvedValue(
        "Based on the PostgreSQL statistics, your event reached a 66.67% attendance rate (2 out of 3 registered attendees checked in). Peak check-in occurred at 08:00 UTC."
      ),
    };
    aiService.setProvider(mockProvider);

    const response = await request(app)
      .post("/api/ai/insights")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        eventId,
        question: "Why are attendance numbers at this level?",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.source).toBe("gemini");
    expect(response.body.data.statistics).toMatchObject({
      totalCapacity: 100,
      totalRegisteredAttendees: 3,
      checkedInCount: 2,
      remainingCapacity: 97,
      noShows: 1,
      attendancePercentage: 66.67,
      peakCheckInTime: { hour: "08:00 UTC", count: 2 },
    });
    expect(response.body.data.insight).toContain("66.67% attendance rate");
  });

  // 2. Unauthorized attendee request
  it("2. rejects request made by an ATTENDEE with 403 Forbidden", async () => {
    const response = await request(app)
      .post("/api/ai/insights")
      .set("Authorization", `Bearer ${attendeeToken}`)
      .send({
        eventId,
        question: "Why are attendance numbers low?",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  // 3. Organizer accessing another organizer's event
  it("3. rejects organizer attempting to access another organizer's event with 403 Forbidden", async () => {
    const response = await request(app)
      .post("/api/ai/insights")
      .set("Authorization", `Bearer ${otherOrganizerToken}`)
      .send({
        eventId,
        question: "Can I see insights for this event?",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  // 4. Gemini API failure fallback
  it("4. gracefully falls back to database statistics when Gemini API fails", async () => {
    const failingProvider: AIProvider = {
      name: "gemini",
      generateInsight: vi.fn().mockRejectedValue(new Error("Gemini API rate limit exceeded (429)")),
    };
    aiService.setProvider(failingProvider);

    const response = await request(app)
      .post("/api/ai/insights")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        eventId,
        question: "Why are attendance numbers low?",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      source: "database",
      statistics: {
        totalCapacity: 100,
        totalRegisteredAttendees: 3,
        checkedInCount: 2,
        remainingCapacity: 97,
        noShows: 1,
        attendancePercentage: 66.67,
      },
      insight: "AI unavailable. Showing calculated event statistics.",
    });
  });

  // 5. Invalid question input
  it("5. rejects invalid or empty question with 400 validation error", async () => {
    const response = await request(app)
      .post("/api/ai/insights")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        eventId,
        question: "   ", // Blank question
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  // 6. Invalid event ID format or not found
  it("6. returns 404 when querying insights for a non-existent event", async () => {
    const nonExistentId = "99999999-9999-9999-9999-999999999999";
    const response = await request(app)
      .post("/api/ai/insights")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        eventId: nonExistentId,
        question: "How is the attendance going?",
      });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  // 7. Unauthenticated request
  it("7. rejects unauthenticated request with 401 Unauthorized", async () => {
    const response = await request(app)
      .post("/api/ai/insights")
      .send({
        eventId,
        question: "How is the attendance going?",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
