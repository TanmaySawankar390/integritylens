import express from "express";
import cors from "cors";
import { errorHandler } from "./http/errors";
import { authRouter } from "./routes/auth";
import { testsRouter } from "./routes/tests";
import { uploadsRouter } from "./routes/uploads";
import { analyticsRouter } from "./routes/analytics";
import { translateRouter } from "./routes/translate";

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/tests", testsRouter);
  app.use("/uploads", uploadsRouter);
  app.use("/analytics", analyticsRouter);
  app.use("/translate", translateRouter);

  app.use(errorHandler);
  return app;
}
