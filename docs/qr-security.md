# QR Sharing & Screenshot Abuse Protection (HR2)

This document provides the security analysis, threat model, and mitigation strategies implemented in the Event Check-In System to counter QR sharing, screenshot reuse, and token tampering.

---

## 1. Threat Model

In event ticketing systems, malicious or non-malicious ticket sharing manifests in several patterns:

```
[Attendee Device] ──(Screenshot)──> [Forwarded via Messaging App] ──> [Secondary Person]
         │                                                                   │
         ▼                                                                   ▼
    First Scan                                                          Second Scan
 (HTTP 201 SUCCESS)                                               (HTTP 409 ALREADY_CHECKED_IN)
```

### Threat Vectors:
1. **Replay / Multi-Entry via Screenshot**: An attendee sends a screenshot or printout of their QR code to multiple friends to gain duplicate unauthorized admissions.
2. **Expired / Stale QR Presentation**: An attendee attempts to use an old ticket from a past event or long-expired registration.
3. **Token Tampering / Brute Force**: An attacker attempts to guess QR token values or alter token payloads.
4. **Database Credential Leakage**: An attacker gaining read access to the database attempts to forge or extract active QR tokens.

---

## 2. Security Architecture & Protections

### Token Design & Cryptographic Guarantees
- **High Entropy**: Raw QR tokens are generated using 32 bytes of cryptographically secure random data (`crypto.randomBytes(32).toString('base64url')`), providing 256 bits of entropy. Brute-force guessing is computationally infeasible.
- **One-Way Hashing**: Tokens are hashed with SHA-256 (`crypto.createHash('sha256')`).
- **Zero Raw Credential Storage**: PostgreSQL stores **only** the `token_hash`. If the database is compromised, active QR tokens cannot be reversed or cloned.

### Lifecycle & Validation Matrix

| Condition | Verification | HTTP Response | Error Code | Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Valid Unused QR** | Hash found, `usedAt IS NULL`, `now < expiresAt` | `201 Created` | — | Check-in recorded, `usedAt = now()` |
| **Reused QR / Screenshot** | `usedAt IS NOT NULL` OR check-in exists | `409 Conflict` | `ALREADY_CHECKED_IN` | Rejected; no duplicate check-in |
| **Expired QR** | `now >= expiresAt` | `400 Bad Request` | `TOKEN_EXPIRED` | Rejected |
| **Invalid / Tampered QR** | `tokenHash` not found in DB | `400 Bad Request` | `TOKEN_INVALID` | Rejected |
| **Cancelled Registration** | `registration.status != REGISTERED` | `400 Bad Request` | `REGISTRATION_INACTIVE` | Rejected |

---

## 3. What is Prevented vs What is NOT Prevented

### What IS Prevented:
- **Duplicate Entry via Shared QR**: Once a token is scanned, any subsequent attempt (via screenshots, original app, or duplicates) is strictly rejected with `409 ALREADY_CHECKED_IN`.
- **Expired Replays**: Stale screenshots presented after the event expiration window are rejected with `400 TOKEN_EXPIRED`.
- **Database-compromised Forgery**: Attackers cannot extract working QR codes from database dumps because raw tokens are never persisted.
- **Cross-Organizer Tampering**: Organizers cannot scan or check in attendees for events they do not own (`403 FORBIDDEN`).

### What is NOT Prevented (Honest Cryptographic Reality):
> [!IMPORTANT]
> **A screenshot taken BEFORE first use is a valid bearer credential.**
>
> In any static QR code system, a raw QR token represents possession of access rights. If Attendee A takes a screenshot and sends it to Attendee B, and Attendee B arrives at the venue gate **first**, Attendee B's scan will succeed. When Attendee A arrives later, Attendee A will be rejected with `409 ALREADY_CHECKED_IN`.
>
> Static QR systems cannot distinguish which physical human holds the smartphone displaying the pixel pattern.

---

## 4. Security vs. Usability Trade-Offs

| Approach | Security Level | Usability / Offline Impact | Adopted in System? |
| :--- | :--- | :--- | :--- |
| **One-Time Hashed Static QR + Expiration Window** | High (Exact-once admission, zero DB token leakage, replay immunity) | Excellent (Works offline, fast scanning, low device battery/data overhead) | **YES (Primary Design)** |
| **Dynamic Animated TOTP QR (e.g. Rotating every 15s)** | Very High (Prevents pre-use screenshots) | Poor (Requires active internet connection on attendee device, high gate scan latency, fails if attendee battery/connectivity is weak) | No (Excessive gate friction for physical events) |
| **Biometric / Photo ID Gate Matching** | Maximum | High operational cost (Requires staff manual verification at entrance) | Optional venue policy |

### Summary
The system chooses the optimal pragmatic trade-off: **cryptographically secure one-time tokens** with **strict expiration windows** and **database-backed atomic invalidation**, preventing all replay, duplication, and database forgery while maintaining instant, friction-free gate admission.
