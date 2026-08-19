# Frontend API Contract & Integration Handoff

This document defines the complete API specification, authentication conventions, payload structures, error formats, and UI integration workflows for building the frontend application for the **MIC Event Check-In System**.

---

## 1. General API Conventions

- **Base URL**: `http://localhost:5050/api`
- **Content-Type**: `application/json` (except `/api/events/:eventId/export` which returns `text/csv`)
- **Authentication**: JWT Bearer Token in `Authorization` header (`Authorization: Bearer <token>`)
- **Standard Success Response Shape**:
  ```json
  {
    "success": true,
    "message": "Optional human-readable confirmation message",
    "data": { ... }
  }
  ```
- **Standard Error Response Shape**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human readable description of the error",
      "details": { ... }
    }
  }
  ```

---

## 2. Complete Endpoint Directory

| Category | Method | Route | Purpose | Auth Required | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/health` | Server & database liveness check | No | Public |
| **Auth** | `POST` | `/auth/register` | Register new organizer or attendee | No | Public |
| **Auth** | `POST` | `/auth/login` | Authenticate user and receive JWT | No | Public |
| **Auth** | `GET` | `/auth/me` | Fetch authenticated user profile | Yes | Any (`ORGANIZER`, `ATTENDEE`) |
| **Events** | `GET` | `/events` | List all upcoming public events | No | Public |
| **Events** | `GET` | `/events/:eventId` | Get single event details | No | Public |
| **Events** | `POST` | `/events` | Create new event with capacity | Yes | `ORGANIZER` |
| **Events** | `PATCH` | `/events/:eventId` | Update event name, date, capacity | Yes | `ORGANIZER` (Event Owner) |
| **Events** | `DELETE`| `/events/:eventId` | Delete event and cascade records | Yes | `ORGANIZER` (Event Owner) |
| **Tickets** | `POST` | `/events/:eventId/register` | Register attendee & generate ticket | Yes | `ATTENDEE` |
| **Tickets** | `GET` | `/events/:eventId/ticket` | Fetch ticket with QR data URL | Yes | `ATTENDEE` |
| **Check-In**| `POST` | `/checkins` | Scan & validate QR token online | Yes | `ORGANIZER` (Event Owner) |
| **Check-In**| `POST` | `/checkins/sync` | Sync offline scanner batch scans | Yes | `ORGANIZER` (Event Owner) |
| **Dashboard**| `GET` | `/events/:eventId/dashboard` | Get PostgreSQL event statistics | Yes | `ORGANIZER` (Event Owner) |
| **Export** | `GET` | `/events/:eventId/export` | Download attendee roster as CSV | Yes | `ORGANIZER` (Event Owner) |
| **AI** | `POST` | `/ai/insights` | Qualitative AI explanation of stats | Yes | `ORGANIZER` (Event Owner) |

---

## 3. Detailed Request & Response Specifications

### 3.1 Authentication

#### `POST /api/auth/register`
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password123!",
    "role": "ATTENDEE"
  }
  ```
  *(Note: `role` defaults to `"ATTENDEE"`. Pass `"ORGANIZER"` to create an organizer account).*
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "id": "c1f7a29e-64d8-4f81-9be4-8a5e7ec4f7e2",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "role": "ATTENDEE",
        "createdAt": "2026-08-19T10:00:00.000Z",
        "updatedAt": "2026-08-19T10:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### `POST /api/auth/login`
- **Request Body**:
  ```json
  {
    "email": "organizer@mic.dev",
    "password": "Organizer@123"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": "a9d8213b-e017-48f6-b19e-4c741e3a6523",
        "name": "MIC Organizer",
        "email": "organizer@mic.dev",
        "role": "ORGANIZER",
        "createdAt": "2026-08-19T08:00:00.000Z",
        "updatedAt": "2026-08-19T08:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "a9d8213b-e017-48f6-b19e-4c741e3a6523",
        "name": "MIC Organizer",
        "email": "organizer@mic.dev",
        "role": "ORGANIZER",
        "createdAt": "2026-08-19T08:00:00.000Z",
        "updatedAt": "2026-08-19T08:00:00.000Z"
      }
    }
  }
  ```

---

### 3.2 Events & Management

#### `GET /api/events`
- **Query Params**: None
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "events": [
        {
          "id": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
          "name": "MIC Annual Hackathon 2026",
          "date": "2026-09-09T09:00:00.000Z",
          "capacity": 100,
          "organizerId": "a9d8213b-e017-48f6-b19e-4c741e3a6523",
          "organizer": {
            "id": "a9d8213b-e017-48f6-b19e-4c741e3a6523",
            "name": "MIC Organizer",
            "email": "organizer@mic.dev"
          },
          "registeredCount": 85,
          "createdAt": "2026-08-19T08:00:00.000Z",
          "updatedAt": "2026-08-19T08:00:00.000Z"
        }
      ]
    }
  }
  ```

#### `GET /api/events/:eventId`
- **Path Params**: `eventId` (UUID)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "event": {
        "id": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
        "name": "MIC Annual Hackathon 2026",
        "date": "2026-09-09T09:00:00.000Z",
        "capacity": 100,
        "organizerId": "a9d8213b-e017-48f6-b19e-4c741e3a6523",
        "organizer": {
          "id": "a9d8213b-e017-48f6-b19e-4c741e3a6523",
          "name": "MIC Organizer",
          "email": "organizer@mic.dev"
        },
        "registeredCount": 85,
        "createdAt": "2026-08-19T08:00:00.000Z",
        "updatedAt": "2026-08-19T08:00:00.000Z"
      }
    }
  }
  ```

#### `POST /api/events`
- **Auth**: `Role.ORGANIZER`
- **Request Body**:
  ```json
  {
    "name": "AI & Web3 Summit 2026",
    "date": "2026-10-15T10:00:00.000Z",
    "capacity": 250
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Event created successfully",
    "data": {
      "event": {
        "id": "78a2d109-7db2-4871-9f93-b6d47b0e1234",
        "name": "AI & Web3 Summit 2026",
        "date": "2026-10-15T10:00:00.000Z",
        "capacity": 250,
        "organizerId": "a9d8213b-e017-48f6-b19e-4c741e3a6523",
        "organizer": {
          "id": "a9d8213b-e017-48f6-b19e-4c741e3a6523",
          "name": "MIC Organizer",
          "email": "organizer@mic.dev"
        },
        "registeredCount": 0,
        "createdAt": "2026-08-19T10:30:00.000Z",
        "updatedAt": "2026-08-19T10:30:00.000Z"
      }
    }
  }
  ```

#### `PATCH /api/events/:eventId`
- **Auth**: `Role.ORGANIZER` (Must be the event creator)
- **Request Body** (at least one field):
  ```json
  {
    "name": "Updated Event Title",
    "capacity": 300
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Event updated successfully",
    "data": { "event": { ... } }
  }
  ```

#### `DELETE /api/events/:eventId`
- **Auth**: `Role.ORGANIZER` (Must be the event creator)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Event deleted successfully"
  }
  ```

---

### 3.3 Event Registration & QR Tickets

#### `POST /api/events/:eventId/register`
- **Auth**: `Role.ATTENDEE`
- **Path Params**: `eventId` (UUID)
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Registered for event successfully",
    "data": {
      "registration": {
        "id": "9b1e2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
        "eventId": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
        "attendeeId": "c1f7a29e-64d8-4f81-9be4-8a5e7ec4f7e2",
        "status": "REGISTERED",
        "createdAt": "2026-08-19T11:00:00.000Z"
      },
      "ticket": {
        "id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
        "registrationId": "9b1e2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
        "token": "dGhpcy1pcy1hLXNlY3VyZS1yYXctYmFzZTY0dXJsLXRva2Vu...",
        "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "expiresAt": "2026-09-09T13:00:00.000Z"
      }
    }
  }
  ```

#### `GET /api/events/:eventId/ticket`
- **Auth**: `Role.ATTENDEE`
- **Path Params**: `eventId` (UUID)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "ticket": {
        "registration": {
          "id": "9b1e2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
          "eventId": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
          "attendeeId": "c1f7a29e-64d8-4f81-9be4-8a5e7ec4f7e2",
          "status": "REGISTERED",
          "createdAt": "2026-08-19T11:00:00.000Z",
          "event": {
            "id": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
            "name": "MIC Annual Hackathon 2026",
            "date": "2026-09-09T09:00:00.000Z",
            "capacity": 100
          }
        },
        "qrToken": {
          "id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
          "expiresAt": "2026-09-09T13:00:00.000Z",
          "usedAt": null
        },
        "token": "dGhpcy1pcy1hLXNlY3VyZS1yYXctYmFzZTY0dXJsLXRva2Vu...",
        "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "isCheckedIn": false,
        "checkedInAt": null
      }
    }
  }
  ```

---

### 3.4 Gate Check-In & Synchronization

#### `POST /api/checkins` (Online Live Check-In)
- **Auth**: `Role.ORGANIZER` (Must own the event)
- **Request Body**:
  ```json
  {
    "token": "dGhpcy1pcy1hLXNlY3VyZS1yYXctYmFzZTY0dXJsLXRva2Vu..."
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Attendee successfully checked in",
    "data": {
      "checkIn": {
        "id": "f5a6b7c8-d9e0-1a2b-3c4d-5e6f7a8b9c0d",
        "registrationId": "9b1e2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
        "checkedInAt": "2026-09-09T08:45:00.000Z",
        "source": "ONLINE",
        "createdAt": "2026-09-09T08:45:00.000Z"
      },
      "attendee": {
        "id": "c1f7a29e-64d8-4f81-9be4-8a5e7ec4f7e2",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "event": {
        "id": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
        "name": "MIC Annual Hackathon 2026",
        "date": "2026-09-09T09:00:00.000Z",
        "capacity": 100,
        "organizerId": "a9d8213b-e017-48f6-b19e-4c741e3a6523"
      }
    }
  }
  ```

#### `POST /api/checkins/sync` (Offline Scanner Batch Synchronization)
- **Auth**: `Role.ORGANIZER`
- **Request Body**:
  ```json
  {
    "deviceId": "gate-scanner-handheld-01",
    "clientScanId": "scan-uuid-550e8400-e29b-41d4-a716-446655440000",
    "token": "dGhpcy1pcy1hLXNlY3VyZS1yYXctYmFzZTY0dXJsLXRva2Vu...",
    "scannedAt": "2026-09-09T08:42:15.000Z"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "result": "SUCCESS",
      "message": "Offline check-in successfully synchronized",
      "syncEvent": {
        "id": "7819e910-1c2d-3e4f-5a6b-7c8d9e0f1a2b",
        "deviceId": "gate-scanner-handheld-01",
        "clientScanId": "scan-uuid-550e8400-e29b-41d4-a716-446655440000",
        "result": "SUCCESS",
        "scannedAt": "2026-09-09T08:42:15.000Z",
        "syncedAt": "2026-09-09T08:50:00.000Z",
        "checkInId": "f5a6b7c8-d9e0-1a2b-3c4d-5e6f7a8b9c0d"
      },
      "checkIn": {
        "id": "f5a6b7c8-d9e0-1a2b-3c4d-5e6f7a8b9c0d",
        "registrationId": "9b1e2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
        "checkedInAt": "2026-09-09T08:42:15.000Z",
        "source": "OFFLINE_SYNC"
      },
      "attendee": {
        "id": "c1f7a29e-64d8-4f81-9be4-8a5e7ec4f7e2",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "event": {
        "id": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
        "name": "MIC Annual Hackathon 2026",
        "date": "2026-09-09T09:00:00.000Z"
      }
    }
  }
  ```

---

### 3.5 Dashboard, CSV Export & AI Insights

#### `GET /api/events/:eventId/dashboard`
- **Auth**: `Role.ORGANIZER` (Must own the event)
- **Path Params**: `eventId` (UUID)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "dashboard": {
        "totalCapacity": 100,
        "totalRegisteredAttendees": 85,
        "checkedInCount": 68,
        "remainingCapacity": 15,
        "noShows": 17,
        "attendancePercentage": 80.0,
        "peakCheckInTime": {
          "hour": "08:00 UTC",
          "count": 42
        }
      }
    }
  }
  ```

#### `GET /api/events/:eventId/export`
- **Auth**: `Role.ORGANIZER` (Must own the event)
- **Headers**:
  - `Content-Type`: `text/csv; charset=utf-8`
  - `Content-Disposition`: `attachment; filename=event-<eventId>-attendees.csv`
- **CSV Content Format**:
  ```csv
  attendee name,attendee email,registration status,registration timestamp,check-in status,check-in timestamp
  "Jane Doe","jane@example.com","REGISTERED","2026-08-19T11:00:00.000Z","CHECKED_IN","2026-09-09T08:45:00.000Z"
  "John Smith","john@example.com","REGISTERED","2026-08-19T11:05:00.000Z","NOT_CHECKED_IN",""
  ```

#### `POST /api/ai/insights`
- **Auth**: `Role.ORGANIZER` (Must own the event)
- **Request Body**:
  ```json
  {
    "eventId": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
    "question": "What does our peak check-in window tell us about gate staffing?"
  }
  ```
- **Response (`200 OK` - When Gemini succeeds)**:
  ```json
  {
    "success": true,
    "data": {
      "source": "gemini",
      "statistics": {
        "totalCapacity": 100,
        "totalRegisteredAttendees": 85,
        "checkedInCount": 68,
        "remainingCapacity": 15,
        "noShows": 17,
        "attendancePercentage": 80.0,
        "peakCheckInTime": {
          "hour": "08:00 UTC",
          "count": 42
        }
      },
      "insight": "Your event experienced a sharp check-in concentration at 08:00 UTC, where 42 out of 68 total attendees arrived within a single hour (over 61% of total attendance). For future events, allocate additional check-in staff between 07:45 and 08:30 UTC to prevent gate bottlenecking."
    }
  }
  ```
- **Response (`200 OK` - When Gemini fails or API key not set)**:
  ```json
  {
    "success": true,
    "data": {
      "source": "database",
      "statistics": {
        "totalCapacity": 100,
        "totalRegisteredAttendees": 85,
        "checkedInCount": 68,
        "remainingCapacity": 15,
        "noShows": 17,
        "attendancePercentage": 80.0,
        "peakCheckInTime": {
          "hour": "08:00 UTC",
          "count": 42
        }
      },
      "insight": "AI unavailable. Showing calculated event statistics."
    }
  }
  ```

---

## 4. Error Code Reference & Status Codes

| HTTP Status | Error Code (`error.code`) | Scenario | Suggested Frontend Handling |
| :--- | :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Malformed JSON, missing fields, invalid UUID, short password | Highlight field in form UI using `error.details` |
| `400` | `TOKEN_INVALID` | Scanned QR token does not exist in database | Display red error banner: "Invalid QR Code" |
| `400` | `TOKEN_EXPIRED` | Ticket scanned past event expiration window | Display warning: "Ticket has expired" |
| `400` | `REGISTRATION_INACTIVE`| Registration has been cancelled | Display warning: "Registration is cancelled" |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT Bearer token | Clear token & redirect to `/login` |
| `403` | `FORBIDDEN` | Attendee calling organizer routes, or organizer accessing another organizer's event | Display permission denied toast |
| `404` | `NOT_FOUND` | Event, registration, or ticket not found | Redirect to 404 page or display not found message |
| `409` | `CONFLICT` | Generic uniqueness conflict | Show collision message |
| `409` | `ALREADY_REGISTERED` | Attendee already registered for this event | Display: "You are already registered" button directs to ticket |
| `409` | `EVENT_FULL` | Capacity reached (`registeredCount >= capacity`) | Display: "Sold Out / Capacity Reached" badge |
| `409` | `ALREADY_CHECKED_IN` | QR token has already been scanned/used | Display prominent warning: "Already Checked In" with timestamp |
| `409` | `CAPACITY_TOO_LOW` | Organizer tries to reduce capacity below registered count | Show form error: "Capacity cannot be lower than existing registrations" |
| `500` | `INTERNAL_SERVER_ERROR`| Unhandled backend exception | Display friendly "Something went wrong" toast |

---

## 5. Socket.IO Real-Time Integration Guide

### Connection Setup
```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:5050", {
  transports: ["websocket"],
  autoConnect: true,
});

// Join the event-specific room when organizer opens event dashboard
export function subscribeToEvent(eventId: string, onCheckIn: (payload: any) => void) {
  socket.emit("join-event", eventId);

  socket.on("checkin.created", (payload) => {
    // payload matches { checkIn, attendee, event }
    onCheckIn(payload);
  });

  return () => {
    socket.emit("leave-event", eventId);
    socket.off("checkin.created");
  };
}
```

### Event Payload (`checkin.created`):
```json
{
  "checkIn": {
    "id": "f5a6b7c8-d9e0-1a2b-3c4d-5e6f7a8b9c0d",
    "registrationId": "9b1e2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "checkedInAt": "2026-09-09T08:45:00.000Z",
    "source": "ONLINE"
  },
  "attendee": {
    "id": "c1f7a29e-64d8-4f81-9be4-8a5e7ec4f7e2",
    "name": "Jane Doe",
    "email": "jane@example.com"
  },
  "event": {
    "id": "e4128f73-3e11-4770-96f1-a1d2e8b99c12",
    "name": "MIC Annual Hackathon 2026"
  }
}
```

---

## 6. Frontend State & Flow Requirements

### 6.1 Authentication State & Storage
- Store JWT in `localStorage` or `sessionStorage` under key `auth_token`.
- Maintain current user state (`id`, `name`, `email`, `role`) in React Context / Zustand store.
- Axios/Fetch interceptor must automatically attach `Authorization: Bearer ${token}`.
- On `401 Unauthorized`, clear stored credentials and route to `/login`.

### 6.2 Attendee Flow
1. **Browse Events (`/events`)**: View upcoming events with live capacity indicators (`registeredCount / capacity`). Disable "Register" button if event is full (`registeredCount >= capacity`).
2. **Register (`/events/:id`)**: Click "Register for Event". On success (`201`), immediately redirect to the Ticket view.
3. **Ticket View (`/events/:id/ticket`)**:
   - Render the QR code image using `ticket.qrCodeDataUrl` (`<img src={qrCodeDataUrl} />`).
   - Display event details, ticket expiration timestamp, and admission status (`CHECKED IN` vs `READY TO SCAN`).
   - Allow user to download or copy raw token if camera scanner is unavailable.

### 6.3 Organizer Flow
1. **Create / Manage Events (`/organizer/events`)**: Create new events with name, ISO date-time, and capacity. Edit capacity or name.
2. **Live Event Dashboard (`/organizer/events/:id/dashboard`)**:
   - Display the 7 PostgreSQL statistics cards:
     1. **Total Capacity** (`totalCapacity`)
     2. **Registered Attendees** (`totalRegisteredAttendees`)
     3. **Checked-In Count** (`checkedInCount`)
     4. **Remaining Capacity** (`remainingCapacity`)
     5. **No-Shows** (`noShows`)
     6. **Attendance Percentage** (`attendancePercentage%` with visual progress ring/bar)
     7. **Peak Check-In Time** (`peakCheckInTime.hour` with count)
   - Real-time updates: Connect to Socket.IO room `event-room:eventId`. When `checkin.created` fires, re-fetch dashboard stats or increment checked-in counter dynamically.
   - **CSV Export Button**: Direct link / fetch trigger to `GET /api/events/:eventId/export` which downloads the file attachment.
3. **Gate Scanner UI (`/organizer/events/:id/scanner`)**:
   - Camera scanner (using `html5-qrcode` or `@zxing/library`) that scans QR text token.
   - Fallback text input field for manual token submission.
   - Instant visual feedback:
     - **Green Success Card**: Displays attendee name, email, check-in timestamp, and source.
     - **Red Error Card**: Displays specific error (e.g. `ALREADY_CHECKED_IN`, `TOKEN_EXPIRED`).
   - Offline Mode Support: Store scans locally in IndexedDB when offline, then batch call `/api/checkins/sync` upon reconnection.
4. **AI Event Insights Panel (`/organizer/events/:id/insights`)**:
   - Question prompt input with quick presets (e.g., *"Why is attendance lower than capacity?"*, *"When was our check-in rush?"*).
   - Card displaying Gemini qualitative analysis alongside authoritative database stats badge.
   - Graceful fallback banner if `source === "database"`.
