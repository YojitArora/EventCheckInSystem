import { prisma } from "../config/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors";
import { CreateEventInput, UpdateEventInput } from "../validators/event.validator";

export interface EventDetail {
  id: string;
  name: string;
  date: Date;
  capacity: number;
  organizerId: string;
  organizer: {
    id: string;
    name: string;
    email: string;
  };
  registeredCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventDashboard {
  totalCapacity: number;
  totalRegisteredAttendees: number;
  checkedInCount: number;
  remainingCapacity: number;
  noShows: number;
  attendancePercentage: number;
  peakCheckInTime: { hour: string; count: number } | null;
}

export interface AttendeeExportRow {
  attendeeName: string;
  attendeeEmail: string;
  registrationStatus: string;
  registrationTimestamp: Date;
  checkInStatus: "CHECKED_IN" | "NOT_CHECKED_IN";
  checkInTimestamp: Date | null;
}

export class EventService {
  private async getOwnedEvent(eventId: string, organizerId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError("You can only access data for your own events");
    }

    return event;
  }

  async getDashboard(eventId: string, organizerId: string): Promise<EventDashboard> {
    await this.getOwnedEvent(eventId, organizerId);

    const registrations = await prisma.registration.findMany({
      where: { eventId, status: "REGISTERED" },
      select: {
        checkIn: { select: { checkedInAt: true } },
      },
    });
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { capacity: true },
    });

    const checkedIn = registrations.flatMap((registration) =>
      registration.checkIn ? [registration.checkIn] : []
    );
    const checkInsByHour = new Map<string, number>();
    for (const checkIn of checkedIn) {
      const hour = `${String(checkIn.checkedInAt.getUTCHours()).padStart(2, "0")}:00 UTC`;
      checkInsByHour.set(hour, (checkInsByHour.get(hour) ?? 0) + 1);
    }
    const peak = [...checkInsByHour.entries()].sort(
      ([hourA, countA], [hourB, countB]) => countB - countA || hourA.localeCompare(hourB)
    )[0];

    const totalRegisteredAttendees = registrations.length;
    const checkedInCount = checkedIn.length;
    return {
      totalCapacity: event.capacity,
      totalRegisteredAttendees,
      checkedInCount,
      remainingCapacity: Math.max(0, event.capacity - totalRegisteredAttendees),
      noShows: totalRegisteredAttendees - checkedInCount,
      attendancePercentage:
        totalRegisteredAttendees === 0
          ? 0
          : Number(((checkedInCount / totalRegisteredAttendees) * 100).toFixed(2)),
      peakCheckInTime: peak ? { hour: peak[0], count: peak[1] } : null,
    };
  }

  async getAttendeeExport(eventId: string, organizerId: string): Promise<AttendeeExportRow[]> {
    await this.getOwnedEvent(eventId, organizerId);

    const registrations = await prisma.registration.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      include: {
        attendee: { select: { name: true, email: true } },
        checkIn: { select: { checkedInAt: true } },
      },
    });

    return registrations.map((registration) => ({
      attendeeName: registration.attendee.name,
      attendeeEmail: registration.attendee.email,
      registrationStatus: registration.status,
      registrationTimestamp: registration.createdAt,
      checkInStatus: registration.checkIn ? "CHECKED_IN" : "NOT_CHECKED_IN",
      checkInTimestamp: registration.checkIn?.checkedInAt ?? null,
    }));
  }

  async createEvent(organizerId: string, data: CreateEventInput): Promise<EventDetail> {
    const event = await prisma.event.create({
      data: {
        name: data.name,
        date: data.date,
        capacity: data.capacity,
        organizerId,
      },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            registrations: {
              where: { status: "REGISTERED" },
            },
          },
        },
      },
    });

    return {
      id: event.id,
      name: event.name,
      date: event.date,
      capacity: event.capacity,
      organizerId: event.organizerId,
      organizer: event.organizer,
      registeredCount: event._count.registrations,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  async listEvents(): Promise<EventDetail[]> {
    const events = await prisma.event.findMany({
      orderBy: { date: "asc" },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            registrations: {
              where: { status: "REGISTERED" },
            },
          },
        },
      },
    });

    return events.map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      capacity: event.capacity,
      organizerId: event.organizerId,
      organizer: event.organizer,
      registeredCount: event._count.registrations,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }));
  }

  async getEventById(eventId: string): Promise<EventDetail> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            registrations: {
              where: { status: "REGISTERED" },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    return {
      id: event.id,
      name: event.name,
      date: event.date,
      capacity: event.capacity,
      organizerId: event.organizerId,
      organizer: event.organizer,
      registeredCount: event._count.registrations,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  async updateEvent(
    eventId: string,
    organizerId: string,
    data: UpdateEventInput
  ): Promise<EventDetail> {
    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: {
            registrations: {
              where: { status: "REGISTERED" },
            },
          },
        },
      },
    });

    if (!existingEvent) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    if (existingEvent.organizerId !== organizerId) {
      throw new ForbiddenError("You can only modify your own events");
    }

    if (data.capacity !== undefined && data.capacity < existingEvent._count.registrations) {
      throw new ConflictError(
        `Cannot reduce capacity to ${data.capacity}. Current registered count is ${existingEvent._count.registrations}`,
        "CAPACITY_TOO_LOW"
      );
    }

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.date !== undefined ? { date: data.date } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            registrations: {
              where: { status: "REGISTERED" },
            },
          },
        },
      },
    });

    return {
      id: updatedEvent.id,
      name: updatedEvent.name,
      date: updatedEvent.date,
      capacity: updatedEvent.capacity,
      organizerId: updatedEvent.organizerId,
      organizer: updatedEvent.organizer,
      registeredCount: updatedEvent._count.registrations,
      createdAt: updatedEvent.createdAt,
      updatedAt: updatedEvent.updatedAt,
    };
  }

  async deleteEvent(eventId: string, organizerId: string): Promise<void> {
    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    if (existingEvent.organizerId !== organizerId) {
      throw new ForbiddenError("You can only delete your own events");
    }

    await prisma.event.delete({
      where: { id: eventId },
    });
  }
}

export const eventService = new EventService();
