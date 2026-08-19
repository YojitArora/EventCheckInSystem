import { prisma } from "../../config/prisma";
import { ForbiddenError, NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { EventDashboard, eventService } from "../event.service";
import { AIProvider } from "./ai.provider";
import { geminiService } from "./gemini.service";

export interface AIInsightResult {
  source: string;
  statistics: EventDashboard;
  insight: string;
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
      const insight = await this.provider.generateInsight(prompt, {
        eventId,
        eventName: event.name,
        question,
        statistics,
      });

      return {
        source: this.provider.name,
        statistics,
        insight,
      };
    } catch (error) {
      logger.warn("AI Provider failed to generate insight, returning database fallback", {
        error: error instanceof Error ? error.message : String(error),
        provider: this.provider.name,
        eventId,
      });

      return {
        source: "database",
        statistics,
        insight: "AI unavailable. Showing calculated event statistics.",
      };
    }
  }
}

export const aiService = new AIService();
