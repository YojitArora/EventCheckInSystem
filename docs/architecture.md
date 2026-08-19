# System Architecture & Technical Specification

This document provides a comprehensive technical overview of the **Event Check-In System** architecture, detailing system components, interaction flows, data isolation, and security guarantees.

---

## 1. High-Level Architecture Overview

The Event Check-In System is built as a robust, concurrency-safe, offline-resilient event management and gate check-in platform.

```mermaid
graph TD
    ClientApp[Web Frontend / Mobile Scanner / Organizer Dashboard]
    
    subgraph "API Gateway & Express Server (Node.js/TypeScript)"
        AuthMiddleware[JWT Authentication & RBAC]
        ZodValidator[Zod Input Validation Middleware]
        RouteLayer[REST Controllers & API Handlers]
        SocketServer[Socket.IO Real-Time Gateway]
        
        subgraph "Service Layer"
            AuthService[Auth Service]
            EventService[Event & Dashboard Service]
            CheckinService[Check-in & Sync Engine]
            AIService[AI Insights Coordinator]
        end
        
        subgraph "AI Provider Layer"
            AIProvider[AIProvider Interface]
            GeminiService[Google Gemini 1.5 Flash Provider]
        end
    end
    
    subgraph "Data Storage & Source of Truth"
        Postgres[(PostgreSQL 17 Database)]
        PrismaORM[Prisma ORM & Migration Layer]
    end

    ClientApp -->|HTTP REST Requests| AuthMiddleware
    ClientApp <-->|Websocket Rooms: event-room:id| SocketServer
    AuthMiddleware --> ZodValidator
    ZodValidator --> RouteLayer
    RouteLayer --> AuthService
    RouteLayer --> EventService
    RouteLayer --> CheckinService
    RouteLayer --> AIService
    
    AIService --> AIProvider
    AIProvider --> GeminiService
    
    AuthService --> PrismaORM
    EventService --> PrismaORM
    CheckinService --> PrismaORM
    PrismaORM --> Postgres
    
    CheckinService -.->|Emit checkin.created on DB Commit| SocketServer
```

---

## 2. Layered Component Architecture

### 1. Presentation & Routing Layer (`src/routes`, `src/controllers`)
- **Routers**: Map HTTP endpoints cleanly to controller methods with route-specific middleware.
- **Controllers**: Thin orchestration handlers. Responsible for extracting validated request payloads, invoking domain services, and shaping consistent JSON/CSV responses.
- **Error Handling**: Global error middleware catches all operational (`AppError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `ValidationError`) and uncaught errors, translating them into standard structured responses.

### 2. Validation & Security Layer (`src/middleware`, `src/validators`)
- **Zod Schemas**: Strict compile-time and runtime validation for path params, query strings, and JSON request bodies before reaching business logic.
- **JWT Authentication**: Asymmetric/HMAC bearer token verification with user hydration.
- **Role-Based Access Control (RBAC)**: Fine-grained authorization enforcing `Role.ORGANIZER` vs `Role.ATTENDEE` restrictions.
- **Resource Ownership**: Strict verification preventing cross-organizer data leakage or unauthorized check-in attempts.

### 3. Business Service Layer (`src/services`)
- **`AuthService`**: Password hashing via `bcrypt` (10 rounds), credential verification, token issuance.
- **`EventService`**: Event CRUD, PostgreSQL-backed dashboard aggregation, and RFC-4180 compliant CSV export generation.
- **`CheckinService`**: High-concurrency online QR check-in, token hash resolution, and offline batch synchronization engine with full idempotency.
- **`AIService`**: Provider-agnostic domain coordinator bridging PostgreSQL statistics with LLM explanation prompts.

### 4. Real-Time Layer (`src/utils/socket.ts`)
- **Socket.IO Integration**: Room-scoped broadcast channel (`event-room:${eventId}`).
- **Strict Post-Commit Hook**: Events (`checkin.created`) are dispatched **strictly after** the database transaction successfully commits.

### 5. Persistence & Transaction Layer (`prisma/schema.prisma`)
- **PostgreSQL 17 Engine**: Relational consistency, row-level locks (`FOR UPDATE`), and ACID transactions.
- **Prisma Client**: Type-safe query generation and automated migrations.

---

## 3. Core Interaction & Data Flows

### A. Concurrent Online Check-In Flow (HR1 & HR2)
```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Gate Scanner (Organizer)
    participant API as CheckIn Controller
    participant Svc as CheckinService
    participant DB as PostgreSQL Transaction
    participant Socket as Socket.IO Hub
    
    Attendee->>API: POST /api/checkins { token: "raw_qr_token" }
    API->>Svc: checkIn(rawToken, organizerId)
    Svc->>Svc: Compute SHA-256(rawToken)
    Svc->>DB: BEGIN TRANSACTION (SERIALIZABLE/ISOLATED)
    DB->>DB: Lookup qr_tokens WHERE token_hash = hash
    alt Token Invalid, Expired, or Already Used
        DB-->>Svc: Rollback & throw error
        Svc-->>API: 400 Bad Request / 409 Conflict
        API-->>Attendee: { success: false, error: ... }
    else Valid Unused Token
        DB->>DB: Verify event.organizerId == organizerId
        DB->>DB: INSERT INTO check_ins (registration_id, source, checked_in_at)
        DB->>DB: UPDATE qr_tokens SET used_at = now()
        DB->>DB: COMMIT TRANSACTION
        DB-->>Svc: CheckIn Record Created
        Svc->>Socket: emitCheckInCreated("event-room:id", payload)
        Svc-->>API: CheckIn Success Result
        API-->>Attendee: 201 Created { success: true, data: ... }
    end
```

---

### B. Offline-First Synchronization Flow (HR3)
```mermaid
sequenceDiagram
    autonumber
    actor Scanner as Offline Scanner Device
    participant API as CheckIn Controller
    participant Svc as CheckinService
    participant DB as PostgreSQL
    
    Note over Scanner: Network Offline: Stores scans in local SQLite/IndexedDB<br/>(deviceId, clientScanId, token, scannedAt)
    Note over Scanner: Network Reconnected!
    Scanner->>API: POST /api/checkins/sync { deviceId, clientScanId, token, scannedAt }
    API->>Svc: syncCheckIn(data, organizerId)
    Svc->>DB: Check existing sync_events WHERE deviceId + clientScanId
    alt Sync Event Already Processed (Idempotent Retry)
        DB-->>Svc: Existing Sync Record
        Svc-->>API: Return cached result (isDuplicateSync: true)
        API-->>Scanner: 200 OK (Previous Result Preserved)
    else First Time Sync Payload
        Svc->>DB: BEGIN TRANSACTION
        alt QR Token already checked in server-side
            DB->>DB: Record sync_events (result: ALREADY_CHECKED_IN)
            DB->>DB: COMMIT
            Svc-->>API: 200 OK (Result: ALREADY_CHECKED_IN)
        else Valid Offline Check-In
            DB->>DB: INSERT INTO check_ins (source: OFFLINE_SYNC)
            DB->>DB: UPDATE qr_tokens SET used_at = now()
            DB->>DB: INSERT INTO sync_events (result: SUCCESS)
            DB->>DB: COMMIT
            Svc-->>API: 200 OK (Result: SUCCESS)
        end
    end
```

---

### C. AI Event Insights Flow (HR4)
```mermaid
sequenceDiagram
    autonumber
    actor Organizer as Event Organizer
    participant API as AI Controller
    participant AISvc as AIService
    participant EvtSvc as EventService (DB)
    participant Gemini as Google Gemini Provider
    
    Organizer->>API: POST /api/ai/insights { eventId, question }
    API->>AISvc: getEventInsights(eventId, organizerId, question)
    AISvc->>EvtSvc: getDashboard(eventId, organizerId)
    Note over EvtSvc: Computes exact PostgreSQL metrics:<br/>capacity, registrations, checkins, no-shows, peak
    EvtSvc-->>AISvc: Authoritative PostgreSQL Statistics
    AISvc->>AISvc: Compile strict prompt (Constrain from calculating)
    alt Gemini Available
        AISvc->>Gemini: generateInsight(prompt, statsContext)
        Gemini-->>AISvc: Qualitative Narrative Explanation
        AISvc-->>API: { source: "gemini", statistics, insight }
        API-->>Organizer: 200 OK (AI Explanation + True Stats)
    else Gemini Offline / Rate Limit / Timeout
        AISvc->>AISvc: Catch error & log warning
        AISvc-->>API: { source: "database", statistics, insight: "AI unavailable..." }
        API-->>Organizer: 200 OK (Graceful Fallback + True Stats)
    end
```

---

## 4. Key Security Principles

1. **Defense-in-Depth Concurrency**: Combines row-level locks (`SELECT ... FOR UPDATE`), transaction isolation, and hardware-level unique database constraints.
2. **Zero Plaintext QR Exposure**: Raw tokens exist only on the user's ticket and are hashed with SHA-256 before database lookup and storage.
3. **Strict Resource Boundary**: Organizers can only inspect, export, check in, or request AI insights for events they explicitly own.
4. **Resilient Provider Architecture**: External dependencies (Socket.IO, Gemini LLM) are decoupled from database transaction boundaries.
