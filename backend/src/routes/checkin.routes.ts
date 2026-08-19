import { Role } from "@prisma/client";
import { Router } from "express";
import { checkinController } from "../controllers/checkin.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  createCheckInSchema,
  syncCheckInSchema,
} from "../validators/checkin.validator";

const router = Router();

// Only organizers / authorized staff can check in attendees
router.post(
  "/",
  authenticate,
  authorize(Role.ORGANIZER),
  validateBody(createCheckInSchema),
  checkinController.createCheckIn.bind(checkinController)
);

// Offline-first synchronization endpoint
router.post(
  "/sync",
  authenticate,
  authorize(Role.ORGANIZER),
  validateBody(syncCheckInSchema),
  checkinController.syncCheckIn.bind(checkinController)
);

export default router;
