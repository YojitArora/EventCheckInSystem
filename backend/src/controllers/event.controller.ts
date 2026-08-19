import type { NextFunction, Request, Response } from "express";
import { eventService } from "../services/event.service";

export class EventController {
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dashboard = await eventService.getDashboard(req.params.eventId as string, req.user!.id);
      res.status(200).json({ success: true, data: { dashboard } });
    } catch (error) {
      next(error);
    }
  }

  async exportAttendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await eventService.getAttendeeExport(req.params.eventId as string, req.user!.id);
      const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;
      const csv = [
        "attendee name,attendee email,registration status,registration timestamp,check-in status,check-in timestamp",
        ...rows.map((row) =>
          [
            row.attendeeName,
            row.attendeeEmail,
            row.registrationStatus,
            row.registrationTimestamp.toISOString(),
            row.checkInStatus,
            row.checkInTimestamp?.toISOString() ?? "",
          ]
            .map(escapeCsv)
            .join(",")
        ),
      ].join("\n");

      res
        .status(200)
        .type("text/csv")
        .set("Content-Disposition", `attachment; filename=event-${req.params.eventId}-attendees.csv`)
        .send(csv);
    } catch (error) {
      next(error);
    }
  }

  async createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = await eventService.createEvent(req.user!.id, req.body);
      res.status(201).json({
        success: true,
        message: "Event created successfully",
        data: { event },
      });
    } catch (error) {
      next(error);
    }
  }

  async listEvents(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const events = await eventService.listEvents();
      res.status(200).json({
        success: true,
        data: { events },
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = await eventService.getEventById(req.params.eventId as string);
      res.status(200).json({
        success: true,
        data: { event },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = await eventService.updateEvent(
        req.params.eventId as string,
        req.user!.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: "Event updated successfully",
        data: { event },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await eventService.deleteEvent(req.params.eventId as string, req.user!.id);
      res.status(200).json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();
