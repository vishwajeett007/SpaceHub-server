import { env } from "../../config/env.js";
import { isRedisReady, redis } from "../../config/redis.js";

const toKeySegment = (value) => encodeURIComponent(String(value));

export const cacheKey = (...segments) => segments.map(toKeySegment).join(":");

const withPrefix = (key) => `${env.REDIS_KEY_PREFIX}${key}`;

export const getCachedValue = async (key) => {
  if (!isRedisReady()) return null;

  try {
    const rawValue = await redis.get(withPrefix(key));
    return rawValue === null ? null : JSON.parse(rawValue);
  } catch (error) {
    console.error(`Failed to read Redis cache key "${key}":`, error.message);
    return null;
  }
};

export const setCachedValue = async (key, value, ttlSeconds) => {
  if (!isRedisReady()) return;

  try {
    await redis.set(withPrefix(key), JSON.stringify(value), {
      EX: Math.max(1, Math.floor(ttlSeconds)),
    });
  } catch (error) {
    console.error(`Failed to write Redis cache key "${key}":`, error.message);
  }
};

export const deleteCachedValues = async (...keys) => {
  if (!isRedisReady() || keys.length === 0) return;

  try {
    await redis.del(keys.map(withPrefix));
  } catch (error) {
    console.error("Failed to invalidate Redis cache keys:", error.message);
  }
};

export const getOrSetCachedValue = async ({ key, ttlSeconds, loader }) => {
  const cachedValue = await getCachedValue(key);
  if (cachedValue !== null) return cachedValue;

  const value = await loader();
  await setCachedValue(key, value, ttlSeconds);
  return value;
};
