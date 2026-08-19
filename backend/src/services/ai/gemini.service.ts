import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { AIProvider } from "./ai.provider";

export interface GeminiConfig {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class GeminiService implements AIProvider {
  readonly name = "gemini";
  private apiKey?: string;
  private model: string;
  private timeoutMs: number;

  constructor(config?: GeminiConfig) {
    this.apiKey = config?.apiKey ?? env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
    this.model = config?.model ?? "gemini-1.5-flash";
    this.timeoutMs = config?.timeoutMs ?? 10_000;
  }

  async generateInsight(prompt: string, _context?: Record<string, unknown>): Promise<string> {
    const key = this.apiKey ?? env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(
      key
    )}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.error(`Gemini API error: HTTP ${response.status}`, { error: errorText });
        throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Gemini returned an empty response candidate");
      }

      return text.trim();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
