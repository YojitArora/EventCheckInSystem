# Offline-First Synchronization & Conflict Policy (HR3)

This document details the design, conflict resolution policy, and idempotency guarantees of the **Offline-First Synchronization Architecture** for the Event Check-In System.

---

## 1. The Offline Problem

Physical event venues (e.g., underground exhibition halls, outdoor festivals, remote conference rooms) frequently suffer from intermittent or completely unavailable network connectivity. 

Gate scanners must continue operating smoothly offline without stranding attendees at entry turnstiles. When scanner devices regain connectivity, they batch-upload queued scans to the central server.

```
┌─────────────────────────────────┐
│   Offline Gate Scanner (Device) │
│  - Reads raw QR token           │
│  - Captures local scannedAt     │
│  - Generates clientScanId       │
│  - Appends to offline queue     │
└────────────────┬────────────────┘
                 │
                 │ Network Restored: POST /api/checkins/sync
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                 Central PostgreSQL Server                   │
│  - Idempotency check on (deviceId, clientScanId)            │
│  - Transactional hash validation & expiration check         │
│  - First committed server transaction creates CheckIn       │
│  - Audit record created in sync_events                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Sync Architecture & Data Model

### The `SyncEvent` Audit & Idempotency Log

Every synchronization attempt—whether successful, duplicate, expired, or invalid—is recorded in the `sync_events` table:

```sql
CREATE TABLE sync_events (
  id               TEXT PRIMARY KEY DEFAULT uuid(),
  device_id        TEXT NOT NULL,
  client_scan_id   TEXT NOT NULL,
  registration_id  TEXT,
  scanned_at       TIMESTAMPTZ NOT NULL,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result           SyncResult NOT NULL,
  check_in_id      TEXT,
  CONSTRAINT sync_events_device_id_client_scan_id_key UNIQUE (device_id, client_scan_id)
);
```

### Key Properties:
1. **`UNIQUE(device_id, client_scan_id)`**: Guarantees that even if a handheld scanner retries its HTTP sync request 10 times due to flaky Wi-Fi, the scan is executed **exactly once**.
2. **Comprehensive Audit**: Failed attempts (`TOKEN_INVALID`, `TOKEN_EXPIRED`, `ALREADY_CHECKED_IN`) are logged alongside successes for venue security auditing.

---

## 3. Conflict Resolution Policy

### Guiding Principle:
> **"The first successfully committed server-side transaction wins."**

### Why Client Timestamps (`scanned_at`) are NOT Trusted for Ordering
- Handheld mobile devices can have desynchronized system clocks (skewed by seconds, minutes, or days).
- Malicious or compromised client devices could fabricate artificial timestamps (e.g., setting `scanned_at` to hours in the past) to backdate an unauthorized scan.
- Distributed offline devices cannot establish cryptographic total ordering of physical events without central consensus.

Therefore:
- `scanned_at` is preserved purely for audit and latency analytics.
- **Server-side commit timestamp and transaction isolation dictate which check-in is accepted.**

---

## 4. Scenario Resolution Matrix

| Scenario | Event Sequence | Result | Database State |
| :--- | :--- | :--- | :--- |
| **Case 1: Standard Offline Sync** | Device A scans offline → Syncs online | `SUCCESS` | `CheckIn` row created with `source: OFFLINE_SYNC`. `SyncEvent` row created. |
| **Case 2: Network Retry / Duplicate Sync** | Device A syncs `(dev1, scan1)` → Network drops → Device A resends `(dev1, scan1)` | `SUCCESS` (`isDuplicateSync: true`) | Idempotent response. Zero duplicate `CheckIn` rows created. |
| **Case 3: Concurrent Multi-Device Offline Scans** | Device A scans Attendee X offline at 10:00 → Device B scans Attendee X offline at 10:02 → Device A syncs first → Device B syncs second | Device A: `SUCCESS`<br>Device B: `ALREADY_CHECKED_IN` | Exactly 1 `CheckIn` row. 2 `SyncEvent` audit rows. |
| **Case 4: Online Scan followed by Late Offline Sync** | Device A checks in Attendee X online → Device B later syncs an offline scan of Attendee X | Device B: `ALREADY_CHECKED_IN` | Exactly 1 `CheckIn` row. `SyncEvent` logs `ALREADY_CHECKED_IN`. |
| **Case 5: Invalid Token Sync** | Offline scanner scanned corrupted/invalid QR | `TOKEN_INVALID` | 0 `CheckIn` rows. `SyncEvent` logs `TOKEN_INVALID`. |
| **Case 6: Expired Token Sync** | Offline scanner scanned token past `expiresAt` | `TOKEN_EXPIRED` | 0 `CheckIn` rows. `SyncEvent` logs `TOKEN_EXPIRED`. |

---

## 5. Automated Test Verification

The test suite in [`tests/security/offline-sync.test.ts`](file:///Users/yojitarora/Documents/MIC/event-checkin-system/backend/tests/security/offline-sync.test.ts) verifies all 6 core behaviors:
1. `Test 1`: Offline scan → successful sync (`SyncResult.SUCCESS`).
2. `Test 2`: Idempotency on repeated sync payload (`isDuplicateSync: true`).
3. `Test 3`: Multi-device offline scan race resolution (`SUCCESS` on first commit, `ALREADY_CHECKED_IN` on second).
4. `Test 4`: Online check-in precedence over subsequent offline sync (`ALREADY_CHECKED_IN`).
5. `Test 5`: Invalid token audit (`SyncResult.TOKEN_INVALID`).
6. `Test 6`: Expired token audit (`SyncResult.TOKEN_EXPIRED`).

All tests pass with 100% database constraint integrity.
