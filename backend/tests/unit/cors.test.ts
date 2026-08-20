import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getAllowedOrigins, isOriginAllowed } from "../../src/config/cors";

describe("CORS Origin Allowlist Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows non-browser requests without origin header (server-to-server, curl, tests)", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed("")).toBe(true);
  });

  it("allows localhost and 127.0.0.1 development origins by default", () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;

    expect(isOriginAllowed("http://localhost:5173")).toBe(true);
    expect(isOriginAllowed("https://localhost:5173")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:5173")).toBe(true);
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
  });

  it("allows private LAN IPs in development by default", () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;

    expect(isOriginAllowed("http://192.168.1.50:5173")).toBe(true);
    expect(isOriginAllowed("https://172.20.10.2:5173")).toBe(true);
    expect(isOriginAllowed("http://10.0.0.5:5173")).toBe(true);
  });

  it("rejects unauthorized external public origins by default", () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;

    expect(isOriginAllowed("https://evil-hacker-site.com")).toBe(false);
    expect(isOriginAllowed("http://malicious-origin.org")).toBe(false);
  });

  it("respects custom ALLOWED_ORIGINS environment variable", () => {
    process.env.ALLOWED_ORIGINS = "https://eventpass.mydomain.com, https://admin.mydomain.com";

    expect(isOriginAllowed("https://eventpass.mydomain.com")).toBe(true);
    expect(isOriginAllowed("https://admin.mydomain.com")).toBe(true);
    expect(isOriginAllowed("https://evil-site.com")).toBe(false);
  });
});
