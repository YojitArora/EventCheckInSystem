# MIC Event Check-In System (Backend)

An enterprise-grade, high-concurrency, offline-resilient event management and gate check-in backend with real-time Socket.IO synchronization and AI-driven analytics powered by Google Gemini.

---

## 1. System Overview & Core Capabilities

The **Event Check-In System** is engineered to eliminate real-world event ticketing failures:
- **HR1: Zero Overbooking & Concurrency Control**: Strict row-level locking (`SELECT ... FOR UPDATE`) and database constraints eliminate TOCTOU race conditions under extreme concurrent load.
- **HR2: Anti-Screenshot & Replay Protection**: High-entropy 256-bit cryptographically secure QR tokens, SHA-256 one-way database hashing, and atomic exact-once admission state transitions.
- **HR3: Offline-First Handheld Gate Synchronization**: Robust sync engine with deterministic conflict resolution ("first server commit wins") and idempotent batch retry handling.
- **HR4: AI Event Insights (Gemini 1.5 Flash)**: Provider-abstracted AI analytics engine that interprets authoritative PostgreSQL statistics while preventing mathematical hallucination.
- **Real-Time Live Dashboard**: Event-room scoped Socket.IO broadcasts (`event-room:eventId`) dispatched strictly post-database commit.
- **Auditable CSV Exports**: RFC-4180 compliant attendee data export with role authorization and ownership boundaries.

---

## 2. System Architecture

```mermaid
graph TD
    ClientApp[Web Client / Mobile Scanner / Organizer Dashboard]
    
    subgraph "Express Server (Node.js & TypeScript)"
        AuthMiddleware[JWT Authentication & RBAC]
        ZodValidator[Zod Input Validation]
        Controllers[API Handlers & Controllers]
        SocketGateway[Socket.IO Real-Time Gateway]
        
        subgraph "Domain Services"
            AuthSvc[Auth Service]
            EventSvc[Event & Stats Service]
            CheckinSvc[Check-In & Sync Engine]
            AISvc[AI Insights Coordinator]
        end
        
        subgraph "AI Provider Layer"
            AIProvider[AIProvider Interface]
            GeminiSvc[Gemini 1.5 Flash Provider]
        end
    end
    
    subgraph "Persistence Layer"
        Postgres[(PostgreSQL 17 Database)]
        Prisma[Prisma ORM & Migrations]
    end

    ClientApp -->|HTTP REST| AuthMiddleware
    ClientApp <-->|Websocket: event-room:id| SocketGateway
    AuthMiddleware --> ZodValidator
    ZodValidator --> Controllers
    Controllers --> AuthSvc
    Controllers --> EventSvc
    Controllers --> CheckinSvc
    Controllers --> AISvc
    
    AISvc --> AIProvider
    AIProvider --> GeminiSvc
    
    AuthSvc --> Prisma
    EventSvc --> Prisma
    CheckinSvc --> Prisma
    Prisma --> Postgres
    
    CheckinSvc -.->|Emit checkin.created on Commit| SocketGateway
```

---

## 3. Technology Stack

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v20+ | High-throughput asynchronous I/O |
| **Language** | TypeScript | v5.5 | Type-safety, strict mode, zero `any` |
| **Framework** | Express | v4.19 | Modular REST routing & middleware |
| **Database** | PostgreSQL | 17 Alpine | Relational consistency, row locks, ACID transactions |
| **ORM / Migrations** | Prisma | v5.22 | Schema definitions, migrations, typed queries |
| **Real-Time** | Socket.IO | v4.8 | Event-based room broadcasting |
| **AI Analytics** | Google Gemini API | 1.5 Flash | Qualitative narrative event insights |
| **Validation** | Zod | v3.23 | Strict schema and type validation |
| **Cryptography** | Node Crypto / bcrypt | — | SHA-256 token hashing, bcrypt password salting |
| **Testing** | Vitest & Supertest | v1.6 | Comprehensive unit, integration, and security tests |
| **Containerization** | Docker & Compose | Compose v2 | Reproducible PostgreSQL environment |

---

## 4. Quick Start & Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v20.x or later)
- [Docker & Docker Compose](https://www.docker.com/)

### Step 1: Clone & Navigate to Backend
```bash
cd event-checkin-system/backend
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Default configuration in `.env`:
```env
NODE_ENV=development
PORT=5050
DATABASE_URL=postgresql://checkin:checkin@localhost:5432/event_checkin?schema=public
JWT_SECRET=dev-super-secret-jwt-key-2026!
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: `GEMINI_API_KEY` is optional for local development and test runs; the system includes an automatic database fallback if the key is omitted or external API calls fail).*

### Step 3: Start PostgreSQL with Docker Compose
```bash
docker compose up -d
```
Check health:
```bash
docker compose ps
```

### Step 4: Install Dependencies & Run Database Migrations
```bash
npm install
npm run prisma:migrate
```

### Step 5: Seed Demo Test Data
```bash
npm run prisma:seed
```

### Step 6: Start the Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5050` with Socket.IO enabled.

---

## 5. Demo Credentials & Test Data

The database seeder (`npm run prisma:seed`) prepares a complete demo environment:

| Account Type | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **Organizer** | `organizer@mic.dev` | `Organizer@123` | `ORGANIZER` |
| **Attendees (1–12)**| `attendee1@mic.dev` ... `attendee12@mic.dev` | `Attendee@123` | `ATTENDEE` |

### Sample Events Seeded:
1. **MIC Annual Hackathon 2026** (`capacity: 10`, `registered: 10/10 FULL`, `checked-in: 6`)
2. **MIC Networking Night** (`capacity: 20`, `registered: 8/20`, `checked-in: 0`)

---

## 6. Complete API Specification

All endpoints are prefixed with `/api`. Authenticated endpoints require `Authorization: Bearer <token>`.

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new User (`name`, `email`, `password`, `role`) |
| `POST` | `/api/auth/login` | Public | Authenticate user and receive JWT bearer token |
| `GET` | `/api/auth/me` | Authenticated | Fetch current authenticated user profile |

### Events (`/api/events`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/events` | Public | List all upcoming events |
| `GET` | `/api/events/:eventId` | Public | Get single event details |
| `POST` | `/api/events` | Organizer | Create a new event (`name`, `date`, `capacity`) |
| `PATCH` | `/api/events/:eventId` | Organizer (Owner)| Update event details or capacity |
| `DELETE`| `/api/events/:eventId` | Organizer (Owner)| Delete an event and cascade records |

### Registration & Tickets (`/api/events/:eventId`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/events/:eventId/register` | Attendee | Concurrency-safe event registration |
| `GET` | `/api/events/:eventId/ticket` | Attendee | Retrieve attendee ticket, QR code data URL, & raw token |

### Check-In & Offline Sync (`/api/checkins`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/checkins` | Organizer (Owner)| Real-time online QR check-in (`{ token }`) |
| `POST` | `/api/checkins/sync` | Organizer (Owner)| Offline scanner batch sync (`{ deviceId, clientScanId, token, scannedAt }`) |

### Dashboard & Analytics (`/api/events/:eventId`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/events/:eventId/dashboard` | Organizer (Owner)| Get PostgreSQL calculated statistics (capacity, attendance %, no-shows, peak) |
| `GET` | `/api/events/:eventId/export` | Organizer (Owner)| Download attendee roster as RFC-4180 CSV |

### AI Event Insights (`/api/ai`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/insights` | Organizer (Owner)| Request Gemini qualitative explanation for event stats (`{ eventId, question }`) |

---

## 7. Verification & Testing Suite

The repository contains automated unit, integration, security, and multi-process concurrency stress tests.

### Run All Standard Tests
```bash
npm test
```

### Run TypeScript Compilation Check
```bash
npm run typecheck
```

### Run Concurrency & Stress Tests
```bash
npm run test:concurrency
```

### Test Suite Summary:
```
Test Files  12 passed (12)
Tests       65 passed (65)
- tests/unit/qr.test.ts (Token generation, hashing, formatting)
- tests/unit/health.test.ts (Health check & 404 routing)
- tests/unit/checkin-realtime.test.ts (Socket emission lifecycle)
- tests/integration/auth.test.ts (Registration, Login, JWT auth)
- tests/integration/events.test.ts (Event CRUD, permissions)
- tests/integration/registration.test.ts (Event registration, tickets)
- tests/integration/checkin.test.ts (Online check-in, duplicate checks)
- tests/integration/dashboard-export.test.ts (Database metrics, CSV formatting)
- tests/integration/socket-realtime.test.ts (Live socket connection & room event)
- tests/integration/ai-insights.test.ts (Gemini provider, prompt grounding, fallbacks)
- tests/security/qr-security.test.ts (HR2 Anti-screenshot, tampering, expiration)
- tests/security/offline-sync.test.ts (HR3 Idempotency, conflict resolution)
```

---

## 8. Deep-Dive Architecture & Security Documentation

For detailed technical rationales, mathematical proofs, and threat modeling, consult the dedicated documentation in [`docs/`](file:///Users/yojitarora/Documents/MIC/event-checkin-system/docs):

- **[docs/architecture.md](file:///Users/yojitarora/Documents/MIC/event-checkin-system/docs/architecture.md)**: Layered design, sequence diagrams, and module boundaries.
- **[docs/database.md](file:///Users/yojitarora/Documents/MIC/event-checkin-system/docs/database.md)**: PostgreSQL 17 schema, ERD, indexes, and referential cascades.
- **[docs/concurrency.md](file:///Users/yojitarora/Documents/MIC/event-checkin-system/docs/concurrency.md)**: Proof of race condition prevention and 100+ concurrent request benchmarks.
- **[docs/qr-security.md](file:///Users/yojitarora/Documents/MIC/event-checkin-system/docs/qr-security.md)**: Cryptographic threat modeling, replay prevention, and screenshot analysis.
- **[docs/offline-sync.md](file:///Users/yojitarora/Documents/MIC/event-checkin-system/docs/offline-sync.md)**: Offline handheld synchronization, idempotency, and conflict policies.
- **[docs/ai.md](file:///Users/yojitarora/Documents/MIC/event-checkin-system/docs/ai.md)**: Gemini prompt engineering, hallucination prevention, and fallback architecture.

---

## 9. Approaches Tried, Lessons Learned & Design Evolutions

1. **Capacity Enforcement**:
   - *Initial Approach*: Application-level `if (count < capacity)` check.
   - *Issue*: Failed under 50+ concurrent requests due to TOCTOU race condition (overbooking by 4-8 slots).
   - *Final Solution*: `SELECT id FROM events WHERE id = $1 FOR UPDATE` within Prisma interactive transaction + `UNIQUE(event_id, attendee_id)` constraint. Verified with 100 concurrent requests without a single overbooking.
2. **QR Token Storage**:
   - *Initial Approach*: Storing signed JWTs or raw UUIDs directly in database rows.
   - *Issue*: Database read compromise would expose active admission credentials.
   - *Final Solution*: 256-bit entropy raw token given to attendee, only SHA-256 `token_hash` stored in PostgreSQL. Zero reversible credentials stored on disk.
3. **Offline Sync Conflict Resolution**:
   - *Initial Approach*: Trusting client-reported `scanned_at` timestamp to decide check-in winner.
   - *Issue*: Handheld clock skew or malicious timestamp backdating could compromise gate security.
   - *Final Solution*: "First committed server transaction wins". Client `scanned_at` is preserved solely for latency auditing in `sync_events`.
4. **AI Analytics Reliability**:
   - *Initial Approach*: Sending raw database schema to LLM and requesting SQL generation.
   - *Issue*: High latency, potential SQL injection risks, and arithmetic inaccuracies on multi-table counts.
   - *Final Solution*: Backend calculates deterministic metrics directly in PostgreSQL, passing frozen authoritative numbers as immutable prompt context to Gemini 1.5 Flash with strict negative constraints against calculation.

---

## 10. Future Improvements & Roadmap

- **Dynamic Rotating TOTP Codes**: Optional client-side animated QR codes rotating every 15 seconds for ultra-high-security VIP venues.
- **Redis Distributed Lock Engine**: Supplementary distributed caching and rate-limiting tier using Redis cluster for sub-millisecond check-in reads.
- **WebAuthn / Passkey Support**: Biometric device authentication for event staff and handheld gate scanners.
- **Multi-Tenant Organization Workspaces**: Team-based permissions, fine-grained gate staff roles, and sub-organizer delegable check-in tokens.
