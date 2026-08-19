import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ConflictError, NotFoundError } from "../utils/errors";
import { generateQrDataUrl, generateSecureToken, hashToken } from "../utils/qr";

export interface QrTicketInfo {
  token: string;
  qrCodeDataUrl: string;
  expiresAt: Date;
}

export interface RegistrationResult {
  id: string;
  eventId: string;
  attendeeId: string;
  status: string;
  createdAt: Date;
  event: {
    id: string;
    name: string;
    date: Date;
    capacity: number;
  };
  attendee: {
    id: string;
    name: string;
    email: string;
  };
  ticket?: QrTicketInfo;
}

export class RegistrationService {
  async registerForEvent(eventId: string, attendeeId: string): Promise<RegistrationResult> {
    try {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);

      const result = await prisma.$transaction(async (tx) => {
        // Concurrency-safe event row locking (SELECT ... FOR UPDATE)
        // This prevents race conditions and ensures capacity checks are strictly serialized per event
        const events = await tx.$queryRaw<
          Array<{ id: string; name: string; capacity: number; date: Date }>
        >`SELECT id, name, capacity, date FROM events WHERE id = ${eventId} FOR UPDATE`;

        if (!events || events.length === 0) {
          throw new NotFoundError(`Event with ID '${eventId}' not found`);
        }

        const event = events[0]!;

        // Check for existing registration by this attendee
        const existingRegistration = await tx.registration.findUnique({
          where: {
            eventId_attendeeId: {
              eventId,
              attendeeId,
            },
          },
        });

        if (existingRegistration && existingRegistration.status === "REGISTERED") {
          throw new ConflictError(
            "You are already registered for this event",
            "ALREADY_REGISTERED"
          );
        }

        // Count current registered attendees
        const currentCount = await tx.registration.count({
          where: {
            eventId,
            status: "REGISTERED",
          },
        });

        if (currentCount >= event.capacity) {
          throw new ConflictError(
            "Event has reached maximum capacity",
            "EVENT_FULL"
          );
        }

        const expiresAt = new Date(
          Math.max(Date.now() + 24 * 60 * 60 * 1000, new Date(event.date).getTime() + 4 * 60 * 60 * 1000)
        );

        let registrationRecord;

        // Handle re-registration if cancelled, otherwise create new
        if (existingRegistration && existingRegistration.status === "CANCELLED") {
          registrationRecord = await tx.registration.update({
            where: { id: existingRegistration.id },
            data: { status: "REGISTERED" },
            include: {
              event: {
                select: { id: true, name: true, date: true, capacity: true },
              },
              attendee: {
                select: { id: true, name: true, email: true },
              },
            },
          });

          // Upsert QR token hash (storing ONLY hash in database)
          await tx.qrToken.upsert({
            where: { registrationId: registrationRecord.id },
            update: {
              tokenHash,
              expiresAt,
              usedAt: null,
            },
            create: {
              registrationId: registrationRecord.id,
              tokenHash,
              expiresAt,
            },
          });
        } else {
          registrationRecord = await tx.registration.create({
            data: {
              eventId,
              attendeeId,
              status: "REGISTERED",
            },
            include: {
              event: {
                select: { id: true, name: true, date: true, capacity: true },
              },
              attendee: {
                select: { id: true, name: true, email: true },
              },
            },
          });

          // Store ONLY tokenHash in the database
          await tx.qrToken.create({
            data: {
              registrationId: registrationRecord.id,
              tokenHash,
              expiresAt,
            },
          });
        }

        return {
          registration: registrationRecord,
          expiresAt,
        };
      });

      const qrCodeDataUrl = await generateQrDataUrl(rawToken);

      return {
        ...result.registration,
        ticket: {
          token: rawToken,
          qrCodeDataUrl,
          expiresAt: result.expiresAt,
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Unique constraint failed on the fields: (`event_id`,`attendee_id`)
        if (error.code === "P2002") {
          throw new ConflictError(
            "You are already registered for this event",
            "ALREADY_REGISTERED"
          );
        }
      }
      throw error;
    }
  }

  async getTicket(eventId: string, attendeeId: string): Promise<RegistrationResult> {
    const registration = await prisma.registration.findUnique({
      where: {
        eventId_attendeeId: {
          eventId,
          attendeeId,
        },
      },
      include: {
        event: {
          select: { id: true, name: true, date: true, capacity: true },
        },
        attendee: {
          select: { id: true, name: true, email: true },
        },
        qrToken: true,
        checkIn: true,
      },
    });

    if (!registration) {
      throw new NotFoundError("Registration not found for this event");
    }

    if (registration.checkIn) {
      return {
        id: registration.id,
        eventId: registration.eventId,
        attendeeId: registration.attendeeId,
        status: registration.status,
        createdAt: registration.createdAt,
        event: registration.event,
        attendee: registration.attendee,
      };
    }

    // Refresh QR token if active (storing new hash)
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Math.max(Date.now() + 24 * 60 * 60 * 1000, new Date(registration.event.date).getTime() + 4 * 60 * 60 * 1000)
    );

    await prisma.qrToken.upsert({
      where: { registrationId: registration.id },
      update: {
        tokenHash,
        expiresAt,
        usedAt: null,
      },
      create: {
        registrationId: registration.id,
        tokenHash,
        expiresAt,
      },
    });

    const qrCodeDataUrl = await generateQrDataUrl(rawToken);

    return {
      id: registration.id,
      eventId: registration.eventId,
      attendeeId: registration.attendeeId,
      status: registration.status,
      createdAt: registration.createdAt,
      event: registration.event,
      attendee: registration.attendee,
      ticket: {
        token: rawToken,
        qrCodeDataUrl,
        expiresAt,
      },
    };
  }
}

export const registrationService = new RegistrationService();
