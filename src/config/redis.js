import { createClient } from "redis";

import { env } from "./env.js";

const MAX_RECONNECT_ATTEMPTS = 5;

const createReconnectStrategy = (retries) => {
  if (retries >= MAX_RECONNECT_ATTEMPTS) {
    return new Error("Redis reconnect limit reached");
  }

  return Math.min(100 * 2 ** retries, 3_000);
};

export const redis = env.REDIS_URL
  ? createClient({
      url: env.REDIS_URL,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy: createReconnectStrategy,
      },
    })
  : null;

if (redis) {
  redis.on("error", (error) => {
    console.error("Redis client error:", error.message);
  });

  redis.on("reconnecting", () => {
    console.warn("Redis client is reconnecting");
  });
}

export const isRedisReady = () => redis?.isReady === true;

export const connectRedis = async () => {
  if (!redis) {
    const message = "Redis is not configured; caching and multi-instance socket broadcasts are disabled.";

    if (env.REDIS_REQUIRED) {
      throw new Error(`${message} Set REDIS_URL when REDIS_REQUIRED=true.`);
    }

    console.warn(message);
    return false;
  }

  if (redis.isReady) return true;

  try {
    await redis.connect();
    console.log("Redis connected successfully");
    return true;
  } catch (error) {
    if (redis.isOpen) redis.destroy();

    console.error("Failed to connect to Redis:", error.message);

    if (env.REDIS_REQUIRED) throw error;
    return false;
  }
};

export const disconnectRedis = async () => {
  if (!redis?.isOpen) return;

  await redis.close();
  console.log("Redis disconnected.");
};
