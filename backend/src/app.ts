import cors from "cors";
import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import apiRoutes from "./routes";
import { logger } from "./utils/logger";

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.debug("Incoming request", { method: req.method, url: req.originalUrl });
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Server is healthy",
    });
  });

  app.use("/api", apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}