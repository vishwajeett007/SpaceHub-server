import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
// import { rateLimit } from "express-rate-limit";

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

// SockJS info handshake and transport fallback routes for voice rooms
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

// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 100,
//   standardHeaders: "draft-8",
//   legacyHeaders: false,
//   handler: (req, res) => {
//     res.status(429).json({
//       success: false,
//       message: "Too many requests. Please try again later.",
//     });
//   },
// });

// app.use(globalLimiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Mount API routes under /api/v1
app.use("/api/v1", routes);

// Handle 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;