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

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SpaceHUB backend is healthy",
    timestamp: new Date().toISOString(),
  });
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