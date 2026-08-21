import { prisma } from "../../config/prisma";
import { ForbiddenError, NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { EventDashboard, eventService } from "../event.service";
import { AIProvider } from "./ai.provider";
import { geminiService } from "./gemini.service";

export interface AIStructuredInsight {
  summary: string;
  observations: string[];
  recommendations: string[];
}

export interface AIInsightResult {
  source: string;
  statistics: EventDashboard;
  insight: string;
  summary: string;
  observations: string[];
  recommendations: string[];
}

export function buildInsightsPrompt(
  question: string,
  stats: EventDashboard,
  eventName: string
): string {
  const peakText = stats.peakCheckInTime
    ? `${stats.peakCheckInTime.hour} with ${stats.peakCheckInTime.count} check-in(s)`
    : "None recorded yet";

  return `You are an expert Event Analytics AI assistant for the event "${eventName}".

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a single raw valid JSON object. Do NOT wrap in Markdown code fences (\`\`\`json), do NOT use markdown headers (#), do NOT use asterisks (**), and do NOT include any introductory or concluding text outside the JSON.
2. The database is the single authoritative source of truth. You MUST strictly use ONLY the provided PostgreSQL event metrics below. Do NOT invent or hallucinate any numbers or percentages.
3. Keep the content clear, concise, and structured specifically for an executive analytics dashboard card.

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

REQUIRED JSON SCHEMA:
{
  "summary": "A concise 2-3 sentence executive summary of the event performance answering the organizer's question without markdown asterisks or headings.",
  "observations": [
    "Important qualitative observation derived from the authoritative metrics",
    "Second key observation regarding turnout, velocity, or capacity"
  ],
  "recommendations": [
    "Actionable operational recommendation for organizers",
    "Second actionable recommendation"
  ]
}`;
}

export class AIService {
  private provider: AIProvider;

  constructor(provider: AIProvider = geminiService) {
    this.provider = provider;
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  getProvider(): AIProvider {
    return this.provider;
  }

  async getEventInsights(
    eventId: string,
    organizerId: string,
    question: string
  ): Promise<AIInsightResult> {
    // 1. Verify event exists and organizer ownership
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, organizerId: true },
    });

    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    if (event.organizerId !== organizerId) {
      throw new ForbiddenError("You can only access AI insights for events you organize");
    }

    // 2. Fetch authoritative database statistics
    const statistics = await eventService.getDashboard(eventId, organizerId);

    // 3. Build structured prompt
    const prompt = buildInsightsPrompt(question, statistics, event.name);

    // 4. Call replaceable AI Provider outside DB transaction with fallback handling
    try {
      const insightRaw = await this.provider.generateInsight(prompt, {
        eventId,
        eventName: event.name,
        question,
        statistics,
      });

      const cleaned = insightRaw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
      const parsed = JSON.parse(cleaned);

      if (!parsed || typeof parsed !== "object" || typeof parsed.summary !== "string") {
        throw new Error("Invalid AI response schema: missing required 'summary' string");
      }

      const summary = parsed.summary.trim();
      const observations = Array.isArray(parsed.observations)
        ? parsed.observations.map((o: unknown) => String(o).trim()).filter(Boolean)
        : [];
      const recommendations = Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map((r: unknown) => String(r).trim()).filter(Boolean)
        : [];

      return {
        source: this.provider.name,
        statistics,
        insight: summary,
        summary,
        observations,
        recommendations,
      };
    } catch (error) {
      logger.warn("AI Provider failed to generate insight, returning database fallback", {
        error: error instanceof Error ? error.message : String(error),
        provider: this.provider.name,
        eventId,
      });

      const fallbackObservations: string[] = [
        `Attendance rate is currently at ${statistics.attendancePercentage}% (${statistics.checkedInCount} of ${statistics.totalRegisteredAttendees} registered attendees checked in).`,
        `There are ${statistics.noShows} registered attendees who have not checked in yet.`,
        statistics.peakCheckInTime
          ? `Peak arrival surge occurred at ${statistics.peakCheckInTime.hour} with ${statistics.peakCheckInTime.count} check-ins.`
          : "No check-in surge has been recorded yet.",
      ];

      const fallbackRecommendations: string[] = [
        "Monitor live gate throughput and adjust volunteer staffing to match arrival traffic.",
        "Send reminder notifications or follow-ups to registered attendees who have not yet arrived.",
      ];

      return {
        source: "database",
        statistics,
        insight: "AI unavailable. Showing calculated event statistics.",
        summary: "AI unavailable. Showing calculated event statistics.",
        observations: fallbackObservations,
        recommendations: fallbackRecommendations,
      };
    }
  }
}

export const aiService = new AIService();
