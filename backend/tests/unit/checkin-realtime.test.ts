import { CheckInSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  emitCheckInCreated: vi.fn(),
}));

vi.mock("../../src/config/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("../../src/utils/socket", () => ({
  emitCheckInCreated: mocks.emitCheckInCreated,
}));

import { checkinService } from "../../src/services/checkin.service";

describe("check-in real-time emission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits checkin.created only after a successful transaction commits", async () => {
    const event = { id: "event-1", name: "Event", date: new Date(), capacity: 10, organizerId: "organizer-1" };
    const checkIn = { id: "checkin-1", registrationId: "registration-1", checkedInAt: new Date(), source: CheckInSource.ONLINE, createdAt: new Date() };
    const tx = {
      qrToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "qr-1",
          registrationId: "registration-1",
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          registration: {
            status: "REGISTERED",
            checkIn: null,
            attendee: { id: "attendee-1", name: "Attendee", email: "attendee@mic.dev" },
            event,
          },
        }),
      },
      checkIn: { create: vi.fn().mockResolvedValue(checkIn) },
      qrTokenUpdate: vi.fn(),
    };
    // The service uses the same Prisma delegate name for both lookup and update.
    Object.assign(tx.qrToken, { update: vi.fn().mockResolvedValue({}) });
    mocks.transaction.mockImplementation(async (callback) => callback(tx));

    await checkinService.checkIn("raw-token", "organizer-1");

    expect(mocks.emitCheckInCreated).toHaveBeenCalledOnce();
    expect(mocks.emitCheckInCreated).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ checkIn, event })
    );
  });

  it("does not emit when the check-in transaction fails", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("transaction rolled back"));

    await expect(checkinService.checkIn("raw-token", "organizer-1")).rejects.toThrow("transaction rolled back");
    expect(mocks.emitCheckInCreated).not.toHaveBeenCalled();
  });
});
