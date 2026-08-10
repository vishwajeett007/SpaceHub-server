import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import routes from "./routes.js";
import { notFoundHandler } from "./shared/middlewares/notFoundHandler.js";
import { errorHandler } from "./shared/middlewares/errorHandler.js";

const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SpaceHUB backend is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res, next) => {
  if (req.path.startsWith("/ws")) {
    if (req.path === "/ws/info" || req.path.endsWith("/info")) {
      return res.status(200).json({
        websocket: true,
        origins: ["*:*"],
        cookie_needed: false,
        entropy: Math.floor(Math.random() * 2147483647),
      });
    }
    if (req.path.includes("/iframe")) {
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send("<!DOCTYPE html><html><head><script>document.domain = document.domain;</script></head><body></body></html>");
    }
    if (req.path.includes("/xhr") || req.path.includes("/eventsource") || req.path.includes("/jsonp")) {
      return res.status(200).send("o\n");
    }
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;