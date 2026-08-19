import { CheckInSource, Prisma, SyncResult } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError, ConflictError, ForbiddenError } from "../utils/errors";
import { hashToken } from "../utils/qr";
import { emitCheckInCreated } from "../utils/socket";
import { SyncCheckInInput } from "../validators/checkin.validator";

export interface CheckInResult {
  checkIn: {
    id: string;
    registrationId: string;
    checkedInAt: Date;
    source: CheckInSource;
    createdAt: Date;
  };
  attendee: {
    id: string;
    name: string;
    email: string;
  };
  event: {
    id: string;
    name: string;
    date: Date;
    capacity: number;
    organizerId: string;
  };
}

export interface SyncCheckInResult {
  result: SyncResult;
  isDuplicateSync?: boolean;
  message: string;
  syncEvent: {
    id: string;
    deviceId: string;
    clientScanId: string;
    result: SyncResult;
    scannedAt: Date;
    syncedAt: Date;
    checkInId?: string | null;
  };
  checkIn?: {
    id: string;
    registrationId: string;
    checkedInAt: Date;
    source: CheckInSource;
  };
  attendee?: {
    id: string;
    name: string;
    email: string;
  };
  event?: {
    id: string;
    name: string;
    date: Date;
  };
}

export class CheckinService {
  async checkIn(rawToken: string, organizerId: string): Promise<CheckInResult> {
    const tokenHash = hashToken(rawToken);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Find QR token by hash
        const qrToken = await tx.qrToken.findUnique({
          where: { tokenHash },
          include: {
            registration: {
              include: {
                attendee: {
                  select: { id: true, name: true, email: true },
                },
                event: {
                  select: {
                    id: true,
                    name: true,
                    date: true,
                    capacity: true,
                    organizerId: true,
                  },
                },
                checkIn: true,
              },
            },
          },
        });

        // 1. Invalid token
        if (!qrToken) {
          throw new AppError(400, "TOKEN_INVALID", "Invalid or unknown QR token");
        }

        // 2. Token already used / checked in
        if (qrToken.usedAt !== null || qrToken.registration.checkIn !== null) {
          throw new ConflictError(
            "Attendee has already checked in with this token",
            "ALREADY_CHECKED_IN"
          );
        }

        // 3. Token expired
        if (new Date() > qrToken.expiresAt) {
          throw new AppError(400, "TOKEN_EXPIRED", "QR token has expired");
        }

        // 4. Registration inactive
        if (qrToken.registration.status !== "REGISTERED") {
          throw new AppError(400, "REGISTRATION_INACTIVE", "Registration is inactive or cancelled");
        }

        // 5. Organizer ownership check
        if (qrToken.registration.event.organizerId !== organizerId) {
          throw new ForbiddenError("You can only check in attendees for events you organize");
        }

        // Create CheckIn record
        const checkIn = await tx.checkIn.create({
          data: {
            registrationId: qrToken.registrationId,
            checkedInAt: new Date(),
            source: CheckInSource.ONLINE,
          },
        });

        // Invalidate QR Token (one-time use)
        await tx.qrToken.update({
          where: { id: qrToken.id },
          data: { usedAt: new Date() },
        });

        return {
          checkIn,
          attendee: qrToken.registration.attendee,
          event: qrToken.registration.event,
        };
      });

      // Emit only AFTER database commit
      emitCheckInCreated(result.event.id, result);

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Unique constraint failed on check_ins.registration_id
        if (error.code === "P2002") {
          throw new ConflictError(
            "Attendee has already checked in",
            "ALREADY_CHECKED_IN"
          );
        }
      }
      throw error;
    }
  }

  async syncCheckIn(
    data: SyncCheckInInput,
    _organizerId: string
  ): Promise<SyncCheckInResult> {
    // 1. Idempotency check: verify if (deviceId, clientScanId) was already processed
    const existingSync = await prisma.syncEvent.findUnique({
      where: {
        deviceId_clientScanId: {
          deviceId: data.deviceId,
          clientScanId: data.clientScanId,
        },
      },
      include: {
        checkIn: true,
        registration: {
          include: {
            attendee: { select: { id: true, name: true, email: true } },
            event: { select: { id: true, name: true, date: true } },
          },
        },
      },
    });

    if (existingSync) {
      return {
        result: existingSync.result,
        isDuplicateSync: true,
        message: `Sync event previously processed with result: ${existingSync.result}`,
        syncEvent: {
          id: existingSync.id,
          deviceId: existingSync.deviceId,
          clientScanId: existingSync.clientScanId,
          result: existingSync.result,
          scannedAt: existingSync.scannedAt,
          syncedAt: existingSync.syncedAt,
          checkInId: existingSync.checkInId,
        },
        checkIn: existingSync.checkIn || undefined,
        attendee: existingSync.registration?.attendee,
        event: existingSync.registration?.event,
      };
    }

    const tokenHash = hashToken(data.token);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Find QR token by hash
        const qrToken = await tx.qrToken.findUnique({
          where: { tokenHash },
          include: {
            registration: {
              include: {
                attendee: {
                  select: { id: true, name: true, email: true },
                },
                event: {
                  select: {
                    id: true,
                    name: true,
                    date: true,
                  },
                },
                checkIn: true,
              },
            },
          },
        });

        // 1. Case: Invalid token
        if (!qrToken) {
          const syncEvent = await tx.syncEvent.create({
            data: {
              deviceId: data.deviceId,
              clientScanId: data.clientScanId,
              scannedAt: data.scannedAt,
              result: SyncResult.TOKEN_INVALID,
            },
          });

          return {
            result: SyncResult.TOKEN_INVALID,
            message: "Invalid or unknown QR token",
            syncEvent: {
              id: syncEvent.id,
              deviceId: syncEvent.deviceId,
              clientScanId: syncEvent.clientScanId,
              result: syncEvent.result,
              scannedAt: syncEvent.scannedAt,
              syncedAt: syncEvent.syncedAt,
              checkInId: null,
            },
          };
        }

        // 2. Case: Expired token
        if (new Date() > qrToken.expiresAt || data.scannedAt > qrToken.expiresAt) {
          const syncEvent = await tx.syncEvent.create({
            data: {
              deviceId: data.deviceId,
              clientScanId: data.clientScanId,
              registrationId: qrToken.registrationId,
              scannedAt: data.scannedAt,
              result: SyncResult.TOKEN_EXPIRED,
            },
          });

          return {
            result: SyncResult.TOKEN_EXPIRED,
            message: "QR token has expired",
            syncEvent: {
              id: syncEvent.id,
              deviceId: syncEvent.deviceId,
              clientScanId: syncEvent.clientScanId,
              result: syncEvent.result,
              scannedAt: syncEvent.scannedAt,
              syncedAt: syncEvent.syncedAt,
              checkInId: null,
            },
            attendee: qrToken.registration.attendee,
            event: qrToken.registration.event,
          };
        }

        // 3. Case: Already checked in (Conflict Policy: first committed server-side check-in wins)
        if (qrToken.usedAt !== null || qrToken.registration.checkIn !== null) {
          const syncEvent = await tx.syncEvent.create({
            data: {
              deviceId: data.deviceId,
              clientScanId: data.clientScanId,
              registrationId: qrToken.registrationId,
              scannedAt: data.scannedAt,
              result: SyncResult.ALREADY_CHECKED_IN,
              checkInId: qrToken.registration.checkIn?.id || null,
            },
          });

          return {
            result: SyncResult.ALREADY_CHECKED_IN,
            message: "Attendee is already checked in",
            syncEvent: {
              id: syncEvent.id,
              deviceId: syncEvent.deviceId,
              clientScanId: syncEvent.clientScanId,
              result: syncEvent.result,
              scannedAt: syncEvent.scannedAt,
              syncedAt: syncEvent.syncedAt,
              checkInId: syncEvent.checkInId,
            },
            attendee: qrToken.registration.attendee,
            event: qrToken.registration.event,
          };
        }

        // 4. Case: Registration inactive
        if (qrToken.registration.status !== "REGISTERED") {
          const syncEvent = await tx.syncEvent.create({
            data: {
              deviceId: data.deviceId,
              clientScanId: data.clientScanId,
              registrationId: qrToken.registrationId,
              scannedAt: data.scannedAt,
              result: SyncResult.ALREADY_CHECKED_IN,
            },
          });

          return {
            result: SyncResult.ALREADY_CHECKED_IN,
            message: "Registration is inactive or cancelled",
            syncEvent,
          };
        }

        // 5. Successful offline check-in creation
        const checkIn = await tx.checkIn.create({
          data: {
            registrationId: qrToken.registrationId,
            checkedInAt: data.scannedAt,
            source: CheckInSource.OFFLINE_SYNC,
          },
        });

        // Invalidate token
        await tx.qrToken.update({
          where: { id: qrToken.id },
          data: { usedAt: new Date() },
        });

        // Record successful SyncEvent
        const syncEvent = await tx.syncEvent.create({
          data: {
            deviceId: data.deviceId,
            clientScanId: data.clientScanId,
            registrationId: qrToken.registrationId,
            scannedAt: data.scannedAt,
            result: SyncResult.SUCCESS,
            checkInId: checkIn.id,
          },
        });

        return {
          result: SyncResult.SUCCESS,
          message: "Offline check-in successfully synchronized",
          syncEvent: {
            id: syncEvent.id,
            deviceId: syncEvent.deviceId,
            clientScanId: syncEvent.clientScanId,
            result: syncEvent.result,
            scannedAt: syncEvent.scannedAt,
            syncedAt: syncEvent.syncedAt,
            checkInId: checkIn.id,
          },
          checkIn,
          attendee: qrToken.registration.attendee,
          event: qrToken.registration.event,
        };
      });

      // Emit only AFTER database commit if sync succeeded
      if (result.result === SyncResult.SUCCESS && result.event) {
        emitCheckInCreated(result.event.id, result);
      }

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle race condition on check_ins unique constraint
        if (error.code === "P2002") {
          const existing = await prisma.checkIn.findFirst({
            where: {
              registration: {
                qrToken: { tokenHash },
              },
            },
          });

          const syncEvent = await prisma.syncEvent.create({
            data: {
              deviceId: data.deviceId,
              clientScanId: data.clientScanId,
              registrationId: existing?.registrationId,
              scannedAt: data.scannedAt,
              result: SyncResult.ALREADY_CHECKED_IN,
              checkInId: existing?.id,
            },
          });

          return {
            result: SyncResult.ALREADY_CHECKED_IN,
            message: "Attendee is already checked in",
            syncEvent,
          };
        }
      }
      throw error;
    }
  }
}

export const checkinService = new CheckinService();
