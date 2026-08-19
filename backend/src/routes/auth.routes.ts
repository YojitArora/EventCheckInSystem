import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { loginSchema, registerSchema } from "../validators/auth.validator";

const router = Router();

router.post(
  "/register",
  validateBody(registerSchema),
  authController.register.bind(authController)
);

router.post(
  "/login",
  validateBody(loginSchema),
  authController.login.bind(authController)
);

router.get(
  "/me",
  authenticate,
  authController.getMe.bind(authController)
);

export default router;
