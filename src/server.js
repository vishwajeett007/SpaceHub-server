import "dotenv/config";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/prisma.js";
import { initializeChatSockets } from "./modules/chat/chat.socket.js";
import { initializeWebRTCSockets } from "./modules/webrtc/webrtc.socket.js";
import { initializeNativeWebSockets } from "./modules/chat/nativeWebsocket.js";

const PORT = Number(env.PORT) || 5000;

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
  },
});

initializeChatSockets(io);
initializeWebRTCSockets(io);
initializeNativeWebSockets(httpServer);

let isShuttingDown = false;

async function startServer() {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log(`🚀 SpaceHUB Backend running on port ${PORT}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    await disconnectDB();
    process.exit(1);
  }
}

async function shutdown(reason, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`⚠️ ${reason}. Shutting down gracefully...`);

  const forceShutdownTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10_000);
  forceShutdownTimer.unref();

  const finishShutdown = async () => {
    try {
      await disconnectDB();
      console.log("Database disconnected.");
    } catch (error) {
      console.error("Error while disconnecting database:", error);
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
      console.log("HTTP server closed.");
    }
    await finishShutdown();
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM received"));
process.on("SIGINT", () => void shutdown("SIGINT received"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  void shutdown("Unhandled promise rejection", 1);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

startServer();