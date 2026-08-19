import http from "http";
import { CheckInSource, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { io as ClientIO, Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { signToken } from "../../src/utils/jwt";
import { generateSecureToken, hashToken } from "../../src/utils/qr";
import { initSocket } from "../../src/utils/socket";

describe("Socket.IO Real-Time Updates Integration", () => {
  let server: http.Server;
  let serverPort: number;
  let clientSocket: ClientSocket;
  let organizerToken: string;
  let eventId: string;
  let validQrToken: string;

  beforeAll(
    () =>
      new Promise<void>(async (resolve) => {
        const app = createApp();
        server = http.createServer(app);
        initSocket(server);

        server.listen(0, async () => {
          const address = server.address();
          if (address && typeof address === "object") {
            serverPort = address.port;
          }

          const passwordHash = await bcrypt.hash("Password123!", 10);
          const suffix = `${Date.now()}-${Math.random()}`;

          const organizer = await prisma.user.create({
            data: {
              name: "Socket Organizer",
              email: `socket-org-${suffix}@mic.dev`,
              passwordHash,
              role: Role.ORGANIZER,
            },
          });
          organizerToken = signToken({
            userId: organizer.id,
            email: organizer.email,
            role: organizer.role,
          });

          const event = await prisma.event.create({
            data: {
              name: "Socket Event",
              date: new Date("2030-05-01T18:00:00.000Z"),
              capacity: 50,
              organizerId: organizer.id,
            },
          });
          eventId = event.id;

          const attendee = await prisma.user.create({
            data: {
              name: "Socket Attendee",
              email: `socket-attendee-${suffix}@mic.dev`,
              passwordHash,
              role: Role.ATTENDEE,
            },
          });

          const registration = await prisma.registration.create({
            data: {
              eventId,
              attendeeId: attendee.id,
            },
          });

          validQrToken = generateSecureToken();
          await prisma.qrToken.create({
            data: {
              registrationId: registration.id,
              tokenHash: hashToken(validQrToken),
              expiresAt: new Date(Date.now() + 3600_000),
            },
          });

          clientSocket = ClientIO(`http://localhost:${serverPort}`, {
            transports: ["websocket"],
          });

          clientSocket.on("connect", () => {
            clientSocket.emit("join-event", eventId);
            resolve();
          });
        });
      })
  );

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        if (clientSocket && clientSocket.connected) {
          clientSocket.disconnect();
        }
        if (server) {
          server.close(() => resolve());
        } else {
          resolve();
        }
      })
  );

  it("emits checkin.created event to event-room:eventId upon successful check-in", async () => {
    const checkInReceivedPromise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout waiting for checkin.created"));
      }, 4000);

      clientSocket.on("checkin.created", (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    const response = await request(server)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({ token: validQrToken });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const receivedPayload = await checkInReceivedPromise;
    expect(receivedPayload).toBeDefined();
    expect(receivedPayload.event.id).toBe(eventId);
    expect(receivedPayload.checkIn.source).toBe(CheckInSource.ONLINE);
    expect(receivedPayload.attendee.name).toBe("Socket Attendee");
  });

  it("does not emit checkin.created when check-in fails (e.g. reused token)", async () => {
    let receivedAfterFail = false;
    const failListener = () => {
      receivedAfterFail = true;
    };
    clientSocket.on("checkin.created", failListener);

    const response = await request(server)
      .post("/api/checkins")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({ token: validQrToken }); // Already used!

    expect(response.status).toBe(409);

    await new Promise((resolve) => setTimeout(resolve, 300));
    clientSocket.off("checkin.created", failListener);
    expect(receivedAfterFail).toBe(false);
  });
});
