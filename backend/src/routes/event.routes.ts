import { Role } from "@prisma/client";
import { Router } from "express";
import { eventController } from "../controllers/event.controller";
import { registrationController } from "../controllers/registration.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody, validateParams } from "../middleware/validate.middleware";
import {
  createEventSchema,
  eventIdParamSchema,
  updateEventSchema,
} from "../validators/event.validator";
import { registrationParamSchema } from "../validators/registration.validator";

const router = Router();

// Public / general event listing & details
router.get("/", eventController.listEvents.bind(eventController));

router.get(
  "/:eventId/dashboard",
  authenticate,
  authorize(Role.ORGANIZER),
  validateParams(eventIdParamSchema),
  eventController.getDashboard.bind(eventController)
);

router.get(
  "/:eventId/export",
  authenticate,
  authorize(Role.ORGANIZER),
  validateParams(eventIdParamSchema),
  eventController.exportAttendees.bind(eventController)
);

router.get(
  "/:eventId",
  validateParams(eventIdParamSchema),
  eventController.getEventById.bind(eventController)
);

// Organizer-only event management
router.post(
  "/",
  authenticate,
  authorize(Role.ORGANIZER),
  validateBody(createEventSchema),
  eventController.createEvent.bind(eventController)
);

router.patch(
  "/:eventId",
  authenticate,
  authorize(Role.ORGANIZER),
  validateParams(eventIdParamSchema),
  validateBody(updateEventSchema),
  eventController.updateEvent.bind(eventController)
);

router.delete(
  "/:eventId",
  authenticate,
  authorize(Role.ORGANIZER),
  validateParams(eventIdParamSchema),
  eventController.deleteEvent.bind(eventController)
);

// Attendee-only registration & ticket retrieval
router.post(
  "/:eventId/register",
  authenticate,
  authorize(Role.ATTENDEE),
  validateParams(registrationParamSchema),
  registrationController.registerForEvent.bind(registrationController)
);

router.get(
  "/:eventId/ticket",
  authenticate,
  authorize(Role.ATTENDEE),
  validateParams(registrationParamSchema),
  registrationController.getTicket.bind(registrationController)
);

export default router;
