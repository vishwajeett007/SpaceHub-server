import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { connectDB, disconnectDB, prisma } from "./config/prisma.js";
import { constants } from "node:buffer";
const app = express();

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    })
);

app.set("trust proxy", process.env.NODE_ENV === "production");

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: "Too many requests, please try again later",
}));


async function startServer() {
    try {
        await connectDB();
        console.log("Database connected");
        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        });
        keepAliveTimer = setInterval(async () => {
            try {
                await prisma.$queryRaw`SELECT 1`;
                console.log("Neon keep-alive successful");
            } catch (error) {
                console.error("Neon keep-alive failed:", error.message);
            }
        }, 4 * 60 * 1000);
        console.log("Server started successfully")
    } catch (error) {
        console.log("failed to start the server", error)
        process.exit(1);
    }
}

async function shutdown(reason, exitCode = 0) {
    console.log(`${reason}. Shutting down gracefully...`);

    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
    }

    if (server) {
        server.close(async () => {
            console.log("HTTP server closed");

            await disconnectDB();

            console.log("Database disconnected");
            process.exit(exitCode);
        });

        return;
    }

    await disconnectDB();
    process.exit(exitCode);
}

process.on("unhandledRejection", (error) => {
    console.error("Unhandled rejection:", error);

    shutdown("Unhandled rejection", 1);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);

    shutdown("Uncaught exception", 1);
});

process.on("SIGTERM", () => {
    shutdown("SIGTERM received");
});

process.on("SIGINT", () => {
    shutdown("SIGINT received");
});

startServer();