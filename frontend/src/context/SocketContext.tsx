import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { CheckInSuccessPayload } from "../types";

export interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribeToEvent: (
    eventId: string,
    onCheckIn: (payload: CheckInSuccessPayload) => void
  ) => () => void;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const getSocketServerUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "");
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      return `${protocol}//${hostname}:5050`;
    }
  }
  return "http://localhost:5050";
};

const SOCKET_SERVER_URL = getSocketServerUrl();

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const socketInstance = io(SOCKET_SERVER_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const subscribeToEvent = (
    eventId: string,
    onCheckIn: (payload: CheckInSuccessPayload) => void
  ): (() => void) => {
    if (!socket) return () => {};

    socket.emit("join-event", eventId);

    const handleCheckInCreated = (payload: CheckInSuccessPayload) => {
      onCheckIn(payload);
    };

    socket.on("checkin.created", handleCheckInCreated);

    return () => {
      socket.emit("leave-event", eventId);
      socket.off("checkin.created", handleCheckInCreated);
    };
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, subscribeToEvent }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
