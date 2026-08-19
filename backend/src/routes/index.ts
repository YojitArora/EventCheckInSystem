import { Router } from "express";
import authRoutes from "./auth.routes";
import checkinRoutes from "./checkin.routes";
import eventRoutes from "./event.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/events", eventRoutes);
router.use("/checkins", checkinRoutes);

export default router;
