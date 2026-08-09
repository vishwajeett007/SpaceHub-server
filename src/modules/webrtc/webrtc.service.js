import { prisma } from "../../config/prisma.js";

// In-memory Voice Room Session Store for active WebRTC peer tracking
const activeVoiceRooms = new Map();

export const getOrCreateVoiceSession = async (roomId, userId) => {
  if (!activeVoiceRooms.has(roomId)) {
    activeVoiceRooms.set(roomId, new Set());
  }

  const roomParticipants = activeVoiceRooms.get(roomId);
  roomParticipants.add(userId);

  const userDetails = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, avatarUrl: true },
  });

  return {
    roomId,
    activeParticipantsCount: roomParticipants.size,
    participant: userDetails,
  };
};

export const removeVoiceSession = (roomId, userId) => {
  if (activeVoiceRooms.has(roomId)) {
    const roomParticipants = activeVoiceRooms.get(roomId);
    roomParticipants.delete(userId);
    if (roomParticipants.size === 0) {
      activeVoiceRooms.delete(roomId);
    }
  }
};

export const getVoiceRoomParticipants = async (roomId) => {
  const userIds = Array.from(activeVoiceRooms.get(roomId) || []);
  if (userIds.length === 0) return [];

  return await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, avatarUrl: true },
  });
};
