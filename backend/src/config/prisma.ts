import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Normalizes the PostgreSQL database URL for connection pooling (PgBouncer/Supabase/Neon/Render).
 * Appends `pgbouncer=true` if not already present to disable prepared statements in transaction pooling mode.
 */
function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes("pgbouncer=true")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}pgbouncer=true`;
}

const databaseUrl = getDatabaseUrl();

export const prisma =
  global.__prisma ||
  new PrismaClient({
    datasources: databaseUrl
      ? {
          db: {
            url: databaseUrl,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Maintain singleton instance across module reloads and environments
global.__prisma = prisma;

