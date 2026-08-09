import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../../config/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../../data');
const FILE_PATH = path.join(DATA_DIR, 'community_rooms.json');

const ensureFileExists = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify({}), 'utf8');
    }
  } catch (err) {
    console.error('Failed to ensure community_rooms.json exists:', err);
  }
};

const readStorage = () => {
  ensureFileExists();
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Failed to read community_rooms.json:', err);
    return {};
  }
};

const writeStorage = (data) => {
  ensureFileExists();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write community_rooms.json:', err);
  }
};

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
  const storage = readStorage();
  const keys = await getCommunityKeys(communityId);
  
  const roomMap = new Map();
  for (const key of keys) {
    const rooms = storage[key] || [];
    rooms.forEach((r) => {
      if (r && r.name && !roomMap.has(r.name.toLowerCase())) {
        roomMap.set(r.name.toLowerCase(), r);
      }
    });
  }
  return Array.from(roomMap.values());
};

export const saveRoomForCommunity = async (communityId, roomData) => {
  const storage = readStorage();
  const keys = await getCommunityKeys(communityId);

  for (const key of keys) {
    const list = storage[key] || [];
    const idx = list.findIndex(
      (r) => (r.name || r.roomName || '').toLowerCase() === (roomData.name || roomData.roomName || '').toLowerCase()
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...roomData };
    } else {
      list.push(roomData);
    }
    storage[key] = list;
  }

  writeStorage(storage);
};

export const deleteRoomForCommunity = async (communityId, roomIdOrName) => {
  const storage = readStorage();
  const keys = await getCommunityKeys(communityId);

  for (const key of keys) {
    const list = storage[key] || [];
    storage[key] = list.filter(
      (r) => r.id !== roomIdOrName && (r.name || r.roomName || '').toLowerCase() !== String(roomIdOrName).toLowerCase()
    );
  }

  writeStorage(storage);
};

export const renameRoomForCommunity = async (communityId, roomIdOrName, newName) => {
  const storage = readStorage();
  const keys = await getCommunityKeys(communityId);

  for (const key of keys) {
    const list = storage[key] || [];
    storage[key] = list.map((r) => {
      if (r.id === roomIdOrName || (r.name || r.roomName || '').toLowerCase() === String(roomIdOrName).toLowerCase()) {
        return { ...r, name: newName, roomName: newName };
      }
      return r;
    });
  }

  writeStorage(storage);
};

export const addChannelToGroupInStorage = (roomCodeOrId, channelName, type = 'chat') => {
  const storage = readStorage();
  let updated = false;

  for (const key in storage) {
    const list = storage[key];
    if (Array.isArray(list)) {
      list.forEach((group) => {
        if (
          group.roomCode === roomCodeOrId ||
          group.id === roomCodeOrId ||
          group.name === roomCodeOrId ||
          (group.roomCode && roomCodeOrId && String(group.roomCode).toLowerCase() === String(roomCodeOrId).toLowerCase())
        ) {
          if (type === 'chat') {
            if (!group.chatRooms) group.chatRooms = [];
            if (!group.chatRooms.includes(channelName)) {
              group.chatRooms.push(channelName);
              updated = true;
            }
          } else if (type === 'voice') {
            if (!group.voiceRooms) group.voiceRooms = [];
            if (!group.voiceRooms.includes(channelName)) {
              group.voiceRooms.push(channelName);
              updated = true;
            }
          }
        }
      });
    }
  }

  if (updated) {
    writeStorage(storage);
  }
};

/**
 * Get channels (chat or voice) for a specific group identified by roomCode, id, or name.
 * Returns an array of channel name strings.
 */
export const getChannelsForGroup = (roomCodeOrId, type = 'chat') => {
  const storage = readStorage();
  const channels = new Set();

  for (const key in storage) {
    const list = storage[key];
    if (Array.isArray(list)) {
      list.forEach((group) => {
        if (
          group.roomCode === roomCodeOrId ||
          group.id === roomCodeOrId ||
          group.name === roomCodeOrId ||
          (group.roomCode && roomCodeOrId && String(group.roomCode).toLowerCase() === String(roomCodeOrId).toLowerCase())
        ) {
          const arr = type === 'chat' ? (group.chatRooms || []) : (group.voiceRooms || []);
          arr.forEach((ch) => channels.add(ch));
        }
      });
    }
  }

  return Array.from(channels);
};
