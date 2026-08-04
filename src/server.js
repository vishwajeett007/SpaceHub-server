import "dotenv/config";
import { createServer } from "node:http";

import app from "./app.js";
import {
    connectDB,
    disconnectDB,
    prisma,
} from "./config/prisma.js";

const PORT = Number(process.env.PORT) || 5000;

const httpServer = createServer(app);

let keepAliveTimer = null;
let isShuttingDown = false;

async function startServer() {
    try {
        await connectDB();

        console.log("Database connected successfully");

        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(
                `Environment: ${process.env.NODE_ENV || "development"}`
            );
        });

        if (process.env.ENABLE_DATABASE_KEEP_ALIVE === "true") {
            keepAliveTimer = setInterval(async () => {
                try {
                    await prisma.$queryRaw`SELECT 1`;
                    console.log("Database keep-alive successful");
                } catch (error) {
                    console.error(
                        "Database keep-alive failed:",
                        error.message
                    );
                }
            }, 4 * 60 * 1000);

            keepAliveTimer.unref();
        }

        console.log("Server started successfully");
    } catch (error) {
        console.error("Failed to start the server:", error);

        try {
            await disconnectDB();
        } catch (disconnectError) {
            console.error(
                "Failed to disconnect database:",
                disconnectError
            );
        }

        process.exit(1);
    }
}


async function shutdown(reason, exitCode = 0) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    console.log(`${reason}. Shutting down gracefully...`);

    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }

    const forceShutdownTimer = setTimeout(() => {
        console.error("Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
    }, 10_000);

    forceShutdownTimer.unref();

    const finishShutdown = async () => {
        try {
            await disconnectDB();
            console.log("Database disconnected");
        } catch (error) {
            console.error(
                "Error while disconnecting database:",
                error
            );

            exitCode = 1;
        } finally {
            clearTimeout(forceShutdownTimer);
            process.exit(exitCode);
        }
    };

    if (!httpServer.listening) {
        await finishShutdown();
        return;
    }

    httpServer.close(async (error) => {
        if (error) {
            console.error("Error closing HTTP server:", error);
            exitCode = 1;
        } else {
            console.log("HTTP server closed");
        }

        await finishShutdown();
    });
}

process.on("SIGTERM", () => {
    void shutdown("SIGTERM received");
});

process.on("SIGINT", () => {
    void shutdown("SIGINT received");
});


process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);

    void shutdown("Unhandled promise rejection", 1);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    process.exit(1);
});

startServer();