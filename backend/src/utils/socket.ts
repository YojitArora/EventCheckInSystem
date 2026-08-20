import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { isOriginAllowed } from "../config/cors";
import { logger } from "./logger";

let io: SocketIOServer | null = null;

export function initSocket(httpServer: http.Server): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin '${origin}' not allowed by Socket.IO CORS`));
        }
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.debug(`Socket client connected: ${socket.id}`);

    // Allow clients to join specific event rooms
    socket.on("join-event", (eventId: string) => {
      const roomName = `event-room:${eventId}`;
      socket.join(roomName);
      logger.debug(`Socket ${socket.id} joined room ${roomName}`);
    });

    socket.on("leave-event", (eventId: string) => {
      const roomName = `event-room:${eventId}`;
      socket.leave(roomName);
      logger.debug(`Socket ${socket.id} left room ${roomName}`);
    });

    socket.on("disconnect", () => {
      logger.debug(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitCheckInCreated(eventId: string, payload: unknown): void {
  if (io) {
    const roomName = `event-room:${eventId}`;
    io.to(roomName).emit("checkin.created", payload);
    logger.debug(`Emitted checkin.created to room ${roomName}`);
  }
}
