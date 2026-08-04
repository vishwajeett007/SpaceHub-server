import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";

import routes from "./routes.js";
// import { notFoundHandler } from "./shared/middlewares/notFoundHandler.js";
// import { errorHandler } from "./shared/middlewares/errorHandler.js";

const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(helmet());
app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "SpaceHub backend is healthy",
        timestamp: new Date().toISOString(),
    });
});

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many requests. Please try again later.",
        });
    },
});
app.use(globalLimiter);
app.use(express.json({ limit: "10kb" }));
app.use(
    express.urlencoded({
        extended: true,
        limit: "10kb",
    })
);
app.use(cookieParser());
app.use("/api/v1", routes);
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

app.use((error, req, res, next) => {
    console.error(error);

    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message:
            statusCode === 500
                ? "Internal server error"
                : error.message,
        ...(process.env.NODE_ENV === "development" && {
            stack: error.stack,
        }),
    });
});

export default app;