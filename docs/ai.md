# AI Event Insights Architecture & Reliability (HR4)

This document details the architecture, design principles, hallucination prevention strategies, and fallback mechanisms for the **AI Event Insights Service** (`POST /api/ai/insights`) powered by Google Gemini.

---

## 1. Core Architectural Principle: Separation of Compute and Interpretation

### Guiding Principle:
> **"PostgreSQL is the single source of truth for all quantitative calculations. The LLM (Gemini) strictly provides qualitative analysis, contextual interpretation, and operational recommendations."**

```
┌─────────────────────────────────────────────────────────────┐
│                 1. PostgreSQL Database                      │
│  - Events, Registrations, CheckIns, SyncEvents              │
│  - Relational Aggregations & Precise Timestamps             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Authoritative Query Execution
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            2. Backend Statistics Engine (Node/TS)           │
│  - totalCapacity, registeredAttendees, checkedInCount       │
│  - remainingCapacity, noShows, attendancePercentage         │
│  - peakCheckInTime (Hourly Bucket Aggregations)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Injected into Strict System Prompt
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           3. Gemini LLM (Qualitative Explanation)           │
│  - Receives Organizer's Natural Language Question           │
│  - Explains patterns, attendance trends & bottlenecks       │
│  - Constrained strictly from calculating or inventing data  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Structured Insight Result
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Organizer Dashboard                    │
│  - Guaranteed Exact Numbers + AI Narrative Insights         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Why AI Does NOT Calculate Statistics

Large Language Models (LLMs) are probabilistic next-token predictors. Delegating arithmetic, SQL-style count aggregations, or percentage computations to an LLM introduces severe risks:

1. **Arithmetic Errors & Inconsistency**: LLMs frequently miscalculate multi-step arithmetic, rounding, or time-window aggregations across large sets of records.
2. **Hallucination of Metrics**: Without grounding, an LLM might invent non-existent attendee cohorts or fabricate peak hours.
3. **Database Drift**: If metrics are computed in prompt text rather than relational tables, dashboard charts and AI explanations will disagree, destroying organizer trust.
4. **Auditability & Compliance**: Event managers, sponsors, and venue operators require mathematically verifiable attendance logs matching physical gate turnstiles.

**Solution**: The backend executes precise SQL queries in PostgreSQL, computes deterministic formulas (e.g. `noShows = registered - checkedIn`, `attendancePercentage = (checkedIn / registered) * 100`), and passes the **authoritative metrics** as immutable prompt context to Gemini.

---

## 3. Hallucination Prevention & Prompt Engineering

To guarantee that Gemini never invents or extrapolates fake numbers, our prompt builder ([`buildInsightsPrompt`](file:///Users/yojitarora/Documents/MIC/event-checkin-system/backend/src/services/ai/ai.service.ts)) enforces strict behavioral boundaries:

### Prompt Contract:
1. **Explicit Role Framing**: Assigns the model the role of an analytical assistant evaluating a specified event.
2. **Immutability Directive**: States that the database numbers are final and authoritative.
3. **Negative Constraint**: Explicitly bans generating new counts, percentages, or statistics not provided in the prompt.
4. **Boundary Handling**: Directs the model to clearly state data limitations if the organizer asks questions about metrics not tracked in the database (e.g., ticket revenue, attendee demographics).
5. **Low Sampling Temperature**: Configured with `temperature: 0.2` to minimize creative drift and maximize factual fidelity.

```typescript
export function buildInsightsPrompt(
  question: string,
  stats: EventDashboard,
  eventName: string
): string {
  const peakText = stats.peakCheckInTime
    ? `${stats.peakCheckInTime.hour} with ${stats.peakCheckInTime.count} check-in(s)`
    : "None recorded yet";

  return `You are an expert Event Analytics AI assistant for the event "${eventName}".

CRITICAL CONSTRAINTS:
1. The database is the single source of truth. You MUST strictly use ONLY the provided authoritative statistics below.
2. DO NOT invent, calculate, or hallucinate any numbers, percentages, or metrics.
3. Your job is to provide clear, actionable, and professional qualitative interpretation and recommendations explaining the provided numbers in response to the organizer's question.
4. If the question asks for details not present in the statistics, state what the data shows and note any data limitations politely.

AUTHORITATIVE POSTGRESQL EVENT METRICS:
- Total Capacity: ${stats.totalCapacity}
- Total Registered Attendees: ${stats.totalRegisteredAttendees}
- Checked-In Attendees: ${stats.checkedInCount}
- Remaining Capacity: ${stats.remainingCapacity}
- No-Shows: ${stats.noShows}
- Attendance Rate: ${stats.attendancePercentage}%
- Peak Check-In Window: ${peakText}

ORGANIZER QUESTION:
"${question}"

Provide your professional insight based strictly on the authoritative metrics above:`;
}
```

---

## 4. Provider Abstraction Architecture

To avoid vendor lock-in and enable isolated unit testing without live API keys, the AI layer is designed around an extensible interface:

```typescript
// src/services/ai/ai.provider.ts
export interface AIProvider {
  readonly name: string;
  generateInsight(prompt: string, context?: Record<string, unknown>): Promise<string>;
}
```

### Components:
- **`AIProvider` Interface**: Contract for any LLM engine (Google Gemini, Anthropic Claude, OpenAI, local Ollama/Mistral).
- **`GeminiService`** ([`src/services/ai/gemini.service.ts`](file:///Users/yojitarora/Documents/MIC/event-checkin-system/backend/src/services/ai/gemini.service.ts)): Production implementation targeting the Google Gemini REST API (`gemini-1.5-flash`) with timeout handling (`AbortSignal`) and error classification.
- **`AIService`** ([`src/services/ai/ai.service.ts`](file:///Users/yojitarora/Documents/MIC/event-checkin-system/backend/src/services/ai/ai.service.ts)): High-level domain coordinator handling ownership verification, statistics injection, prompt compilation, and fallback management. Supports dynamic provider injection via `aiService.setProvider(customProvider)`.

---

## 5. Non-Blocking Execution & DB Isolation

> **Critical Rule**: AI API calls are NEVER executed inside database transactions.

1. **Isolation**: External network calls (which may take 500ms–5000ms or suffer network latency) are completely decoupled from PostgreSQL locks and connections.
2. **Resource Safety**: Database connection pools are released immediately after the statistics query finishes, preventing connection exhaustion under heavy dashboard traffic.

---

## 6. Resilience & Graceful Fallback Strategy

External AI services can experience rate limits (HTTP 429), timeouts, temporary outages, or missing API credentials in staging environments. The system must remain 100% operational for event organizers even when the AI provider is unavailable.

### Fallback Behavior:
When the AI provider throws an error:
1. The exception is caught and logged at `WARN` level.
2. The endpoint returns `200 OK` with `source: "database"`.
3. The exact calculated PostgreSQL statistics are returned intact.
4. The `insight` field informs the organizer: `"AI unavailable. Showing calculated event statistics."`

### Success Response:
```json
{
  "success": true,
  "data": {
    "source": "gemini",
    "statistics": {
      "totalCapacity": 100,
      "totalRegisteredAttendees": 80,
      "checkedInCount": 60,
      "remainingCapacity": 20,
      "noShows": 20,
      "attendancePercentage": 75,
      "peakCheckInTime": { "hour": "09:00 UTC", "count": 35 }
    },
    "insight": "Your event attained a strong 75% attendance rate with a pronounced check-in surge at 09:00 UTC (35 check-ins)..."
  }
}
```

### Fallback Response (e.g. Rate Limit or Network Outage):
```json
{
  "success": true,
  "data": {
    "source": "database",
    "statistics": {
      "totalCapacity": 100,
      "totalRegisteredAttendees": 80,
      "checkedInCount": 60,
      "remainingCapacity": 20,
      "noShows": 20,
      "attendancePercentage": 75,
      "peakCheckInTime": { "hour": "09:00 UTC", "count": 35 }
    },
    "insight": "AI unavailable. Showing calculated event statistics."
  }
}
```

---

## 7. Security & Authorization

- **Authentication**: JWT token required (`authenticate` middleware).
- **Role Authorization**: Only users with `Role.ORGANIZER` can access `/api/ai/insights`. Attendees receive `403 FORBIDDEN`.
- **Event Ownership**: Organizers can only request insights for events where `event.organizerId === req.user.id`. Accessing another organizer's event returns `403 FORBIDDEN`.
- **Input Validation**: Zod schema verifies `eventId` is a valid UUID and `question` is non-empty (min 3 chars, max 500 chars).

---

## 8. Verification & Test Suite

The automated test suite in [`tests/integration/ai-insights.test.ts`](file:///Users/yojitarora/Documents/MIC/event-checkin-system/backend/tests/integration/ai-insights.test.ts) validates all functional and security contracts:
1. `Test 1`: Authoritative statistics calculation + Gemini explanation response.
2. `Test 2`: Role check rejection (`403 Forbidden` for Attendee).
3. `Test 3`: Ownership verification (`403 Forbidden` for non-owning Organizer).
4. `Test 4`: Graceful fallback on AI provider failure (returns `source: "database"` and exact stats).
5. `Test 5`: Request body validation (`400 Validation Error` on blank question).
6. `Test 6`: Non-existent event handling (`404 Not Found`).
7. `Test 7`: Unauthenticated request rejection (`401 Unauthorized`).
