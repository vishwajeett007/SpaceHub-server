import { prisma } from "../../config/prisma.js";
import {
  cacheKey,
  deleteCachedValues,
  getOrSetCachedValue,
} from "../../shared/services/cache.js";

const CHAT_MESSAGES_CACHE_TTL_SECONDS = 30;

const channelMessagesCacheKey = (channelId, limit) =>
  cacheKey("chat", "channel", channelId, "messages", limit);

const directMessagesCacheKey = (userId1, userId2, limit) =>
  cacheKey("chat", "direct", ...[userId1, userId2].sort(), "messages", limit);

export const getChannelMessages = async (channelId, limit = 50) => {
  return getOrSetCachedValue({
    key: channelMessagesCacheKey(channelId, limit),
    ttlSeconds: CHAT_MESSAGES_CACHE_TTL_SECONDS,
    loader: () =>
      prisma.message.findMany({
        where: { channelId },
        take: limit,
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      }),
  });
};

export const getDirectMessages = async (userId1, userId2, limit = 50) => {
  return getOrSetCachedValue({
    key: directMessagesCacheKey(userId1, userId2, limit),
    ttlSeconds: CHAT_MESSAGES_CACHE_TTL_SECONDS,
    loader: () =>
      prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId1, receiverId: userId2 },
            { senderId: userId2, receiverId: userId1 },
          ],
        },
        take: limit,
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: { id: true, username: true, avatarUrl: true },
          },
          receiver: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      }),
  });
};

export const createMessage = async ({ senderId, channelId, receiverId, content }) => {
  const message = await prisma.message.create({
    data: {
      senderId,
      channelId: channelId || null,
      receiverId: receiverId || null,
      content,
    },
    include: {
      sender: {
        select: { id: true, username: true, avatarUrl: true },
      },
    },
  });

  const keysToInvalidate = [];
  if (channelId) keysToInvalidate.push(channelMessagesCacheKey(channelId, 50));
  if (receiverId) keysToInvalidate.push(directMessagesCacheKey(senderId, receiverId, 50));
  await deleteCachedValues(...keysToInvalidate);

  return message;
};
