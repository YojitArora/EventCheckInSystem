import { Router } from "express";
import aiRoutes from "./ai.routes";
import authRoutes from "./auth.routes";
import checkinRoutes from "./checkin.routes";
import eventRoutes from "./event.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/events", eventRoutes);
router.use("/checkins", checkinRoutes);
router.use("/ai", aiRoutes);

export default router;
