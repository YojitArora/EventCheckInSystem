import { describe, expect, it } from "vitest";
import { generateQrDataUrl, generateSecureToken, hashToken } from "../../src/utils/qr";

describe("QR Utility Unit Tests", () => {
  it("generates unique secure random tokens with sufficient entropy", () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);

    expect(token1).toBeDefined();
    expect(token2).toBeDefined();
    expect(token1).not.toBe(token2);
    expect(token1.length).toBeGreaterThanOrEqual(40); // base64url length for 32 bytes is ~43 chars
  });

  it("produces deterministic SHA-256 hashes", () => {
    const raw = "sample-raw-token-12345";
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string is 64 characters
    expect(hash1).not.toBe(raw); // Never matches raw token
  });

  it("generates valid data URL QR code images", async () => {
    const raw = "sample-qr-token-value";
    const dataUrl = await generateQrDataUrl(raw);

    expect(dataUrl).toBeDefined();
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
