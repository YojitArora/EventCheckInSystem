import { env } from "../config/env";

type Level = "debug" | "info" | "warn" | "error";

function format(level: Level, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta === undefined ? "" : ` ${JSON.stringify(meta)}`;
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug: (message: string, meta?: unknown) => {
    if (env.NODE_ENV !== "production") {
      console.debug(format("debug", message, meta));
    }
  },
  info: (message: string, meta?: unknown) => {
    console.log(format("info", message, meta));
  },
  warn: (message: string, meta?: unknown) => {
    console.warn(format("warn", message, meta));
  },
  error: (message: string, meta?: unknown) => {
    console.error(format("error", message, meta));
  },
};