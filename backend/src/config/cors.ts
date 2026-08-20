export function getAllowedOrigins(): (string | RegExp)[] {
  return [
    "https://event-check-in-system-o02rv1skd-yojit-arora.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ];
}

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;

  const allowed = getAllowedOrigins();

  return allowed.some((rule) => {
    if (typeof rule === "string") {
      return rule === origin;
    }
    return rule.test(origin);
  });
}