import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MESSAGES_FILE = path.join(__dirname, '../../../data/community_messages.json');

const readMessages = () => {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) {
      const dir = path.dirname(MESSAGES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify({}), 'utf-8');
      return {};
    }
    const data = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading community_messages.json:', err);
    return {};
  }
};

const writeMessages = (messages) => {
  try {
    const dir = path.dirname(MESSAGES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing community_messages.json:', err);
  }
};

export const getRoomMessagesFromStorage = (roomCode) => {
  if (!roomCode) return [];
  const storage = readMessages();
  return storage[roomCode] || [];
};

export const saveRoomMessageToStorage = (roomCode, messagePayload) => {
  if (!roomCode || !messagePayload) return;
  const storage = readMessages();
  if (!storage[roomCode]) storage[roomCode] = [];
  storage[roomCode].push(messagePayload);
  // Maintain max 1000 messages per room
  if (storage[roomCode].length > 1000) {
    storage[roomCode] = storage[roomCode].slice(-1000);
  }
  writeMessages(storage);
};
