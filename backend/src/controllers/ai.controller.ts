import type { NextFunction, Request, Response } from "express";
import { aiService } from "../services/ai/ai.service";
import { AIInsightInput } from "../validators/ai.validator";

export class AIController {
  async getInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId, question } = req.body as AIInsightInput;
      const result = await aiService.getEventInsights(eventId, req.user!.id, question);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AIController();
