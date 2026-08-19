import { Role } from "@prisma/client";
import { Router } from "express";
import { aiController } from "../controllers/ai.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { aiInsightSchema } from "../validators/ai.validator";

const router = Router();

router.post(
  "/insights",
  authenticate,
  authorize(Role.ORGANIZER),
  validateBody(aiInsightSchema),
  aiController.getInsights.bind(aiController)
);

export default router;
