import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/prisma.js';

export const getCommunityKeys = async (communityId) => {
  const keys = [String(communityId)];
  try {
    const comm = await prisma.community.findFirst({
      where: {
        OR: [
          { id: String(communityId) },
          { slug: String(communityId) },
          { name: String(communityId) },
        ],
      },
    });
    if (comm) {
      if (comm.id && !keys.includes(comm.id)) keys.push(comm.id);
      if (comm.slug && !keys.includes(comm.slug)) keys.push(comm.slug);
      if (comm.name && !keys.includes(comm.name)) keys.push(comm.name);
    }
  } catch (err) {
    console.warn('Failed to query community keys from database:', err);
  }
  return keys;
};

export const getRoomsForCommunity = async (communityId) => {
  try {
    const keys = await getCommunityKeys(communityId);
    const rooms = await prisma.communityRoom.findMany({
      where: {
        communityId: { in: keys },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      roomName: r.name,
      roomCode: r.roomCode,
      chatRooms: r.chatRooms || [],
      voiceRooms: r.voiceRooms || [],
    }));
  } catch (err) {
    console.error('Failed to get rooms for community from DB:', err);
    return [];
  }
};

export const saveRoomForCommunity = async (communityId, roomData) => {
  try {
    const name = roomData.name || roomData.roomName || 'Group';
    const roomCode = roomData.roomCode || `ROOM-${randomUUID()}`;

    return await prisma.communityRoom.upsert({
      where: { roomCode },
      update: {
        name,
        chatRooms: roomData.chatRooms || [],
        voiceRooms: roomData.voiceRooms || [],
      },
      create: {
        id: roomData.id || undefined,
        communityId: String(communityId),
        name,
        roomCode,
        chatRooms: roomData.chatRooms || [],
        voiceRooms: roomData.voiceRooms || [],
      },
    });
  } catch (err) {
    console.error('Failed to save room for community to DB:', err);
    throw err;
  }
};

export const deleteRoomForCommunity = async (communityId, roomIdOrName) => {
  try {
    const keys = await getCommunityKeys(communityId);
    await prisma.communityRoom.deleteMany({
      where: {
        communityId: { in: keys },
        OR: [
          { id: String(roomIdOrName) },
          { name: { equals: String(roomIdOrName), mode: 'insensitive' } },
          { roomCode: String(roomIdOrName) },
        ],
      },
    });
  } catch (err) {
    console.error('Failed to delete room for community from DB:', err);
    throw err;
  }
};

export const renameRoomForCommunity = async (communityId, roomIdOrName, newName) => {
  try {
    const keys = await getCommunityKeys(communityId);
    await prisma.communityRoom.updateMany({
      where: {
        communityId: { in: keys },
        OR: [
          { id: String(roomIdOrName) },
          { name: { equals: String(roomIdOrName), mode: 'insensitive' } },
          { roomCode: String(roomIdOrName) },
        ],
      },
      data: {
        name: newName,
      },
    });
  } catch (err) {
    console.error('Failed to rename room for community in DB:', err);
    throw err;
  }
};

export const addChannelToGroupInStorage = async (roomCodeOrId, channelName, type = 'chat') => {
  try {
    const room = await prisma.communityRoom.findFirst({
      where: {
        OR: [
          { roomCode: String(roomCodeOrId) },
          { id: String(roomCodeOrId) },
          { name: { equals: String(roomCodeOrId), mode: 'insensitive' } },
        ],
      },
    });

    if (!room) return;

    if (type === 'chat') {
      const current = room.chatRooms || [];
      if (!current.includes(channelName)) {
        await prisma.communityRoom.update({
          where: { id: room.id },
          data: { chatRooms: [...current, channelName] },
        });
      }
    } else if (type === 'voice') {
      const current = room.voiceRooms || [];
      if (!current.includes(channelName)) {
        await prisma.communityRoom.update({
          where: { id: room.id },
          data: { voiceRooms: [...current, channelName] },
        });
      }
    }
  } catch (err) {
    console.error('Failed to add channel to group in DB:', err);
    throw err;
  }
};

export const getChannelsForGroup = async (roomCodeOrId, type = 'chat') => {
  try {
    const room = await prisma.communityRoom.findFirst({
      where: {
        OR: [
          { roomCode: String(roomCodeOrId) },
          { id: String(roomCodeOrId) },
          { name: { equals: String(roomCodeOrId), mode: 'insensitive' } },
        ],
      },
    });

    if (!room) return [];
    return type === 'chat' ? (room.chatRooms || []) : (room.voiceRooms || []);
  } catch (err) {
    console.error('Failed to get channels for group from DB:', err);
    return [];
  }
};
