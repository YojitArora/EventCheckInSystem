import type { NextFunction, Request, Response } from "express";
import { registrationService } from "../services/registration.service";

export class RegistrationController {
  async registerForEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registration = await registrationService.registerForEvent(
        req.params.eventId as string,
        req.user!.id
      );
      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: { registration },
      });
    } catch (error) {
      next(error);
    }
  }

  async getTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await registrationService.getTicket(
        req.params.eventId as string,
        req.user!.id
      );
      res.status(200).json({
        success: true,
        data: { ticket },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const registrationController = new RegistrationController();
