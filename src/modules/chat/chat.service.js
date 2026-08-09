import { prisma } from "../../config/prisma.js";

export const getChannelMessages = async (channelId, limit = 50) => {
  return await prisma.message.findMany({
    where: { channelId },
    take: limit,
    orderBy: { createdAt: "asc" },
    include: {
      sender: {
        select: { id: true, username: true, avatarUrl: true },
      },
    },
  });
};

export const getDirectMessages = async (userId1, userId2, limit = 50) => {
  return await prisma.message.findMany({
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

  return message;
};
