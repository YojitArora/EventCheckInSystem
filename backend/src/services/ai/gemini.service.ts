import { GoogleGenerativeAI } from "@google/generative-ai";
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
    this.apiKey = config?.apiKey ?? process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY;
    this.model = config?.model ?? process.env.GEMINI_MODEL ?? env.GEMINI_MODEL ?? "gemini-3.6-flash";
    this.timeoutMs = config?.timeoutMs ?? 30_000;
  }

  async generateInsight(prompt: string, _context?: Record<string, unknown>): Promise<string> {
    const apiKey = this.apiKey ?? process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY;

    if (!apiKey) {
      const errorMsg = "GEMINI_API_KEY is not configured in environment variables";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Gemini request timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
    });

    try {
      const responsePromise = generativeModel.generateContent(prompt).then((res) => res.response.text());
      const text = await Promise.race([responsePromise, timeoutPromise]);

      if (!text || !text.trim()) {
        throw new Error("Gemini returned an empty response");
      }

      return text.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[GoogleGenerativeAI Error]: Failed generating insight with model ${this.model}`, {
        model: this.model,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
