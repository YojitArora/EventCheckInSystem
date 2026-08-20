/**
 * CORS Configuration and Allowed Origins Validator
 */

export function getAllowedOrigins(): (string | RegExp)[] {
  const envOrigins = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN;
  if (envOrigins) {
    return envOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  // Development defaults: localhost, 127.0.0.1, and private LAN IP ranges
  return [
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
    /^https?:\/\/(192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/,
  ];
}

export function isOriginAllowed(origin?: string): boolean {
  // Allow non-browser requests (e.g. server-to-server, curl, same-origin, testing)
  if (!origin) return true;

  const allowed = getAllowedOrigins();
  return allowed.some((rule) => {
    if (typeof rule === "string") {
      return rule === origin;
    }
    return rule.test(origin);
  });
}
