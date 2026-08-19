import type { NextFunction, Request, Response } from "express";
import { checkinService } from "../services/checkin.service";

export class CheckinController {
  async createCheckIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      const result = await checkinService.checkIn(token, req.user!.id);
      res.status(201).json({
        success: true,
        message: "Check-in successful",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async syncCheckIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await checkinService.syncCheckIn(req.body, req.user!.id);
      const statusCode = result.isDuplicateSync ? 200 : result.result === "SUCCESS" ? 201 : 200;
      res.status(statusCode).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const checkinController = new CheckinController();
