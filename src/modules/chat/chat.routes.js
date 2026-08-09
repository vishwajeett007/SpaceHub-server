import { Router } from "express";
import {
  getChannelMessagesHandler,
  getDirectMessagesHandler,
  sendMessageHandler,
} from "./chat.controller.js";
import { sendMessageSchema } from "./chat.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import { addChannelToGroupInStorage, getChannelsForGroup } from "../communities/communityRoomsStorage.js";

const router = Router();

router.use(protect);

// Basic Channel & DM Messages
router.get("/channel/:channelId", getChannelMessagesHandler);
router.get("/dm/:userId", getDirectMessagesHandler);
router.post("/message", validateRequest(sendMessageSchema), sendMessageHandler);

// Generic Rooms & New Chatrooms
router.post("/rooms/join", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Joined room successfully", { roomCode: req.body?.roomCode });
});
router.post("/join", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Joined room successfully", { roomCode: req.body?.roomCode });
});
// Chatroom endpoints (Support router mounted at /chat or /new-chatroom)
const handleChatroomCreate = (req, res) => {
  const channelName = req.body?.name || "general";
  const roomCode = req.body?.roomCode;
  if (roomCode && channelName) {
    addChannelToGroupInStorage(roomCode, channelName, "chat");
  }
  return sendResponse(res, HTTP_STATUS.CREATED, "Chatroom created successfully", {
    id: `cr-${Date.now()}`,
    name: channelName,
    roomCode: roomCode,
  });
};

router.post("/new-chatroom/create", handleChatroomCreate);
router.post("/create", handleChatroomCreate);

const handleChatroomSummary = (req, res) => {
  const roomCode = req.query.roomCode || req.params.roomId || '';
  const storedChatRooms = roomCode ? getChannelsForGroup(roomCode, 'chat') : [];
  const rooms = storedChatRooms.map((name, idx) => ({ id: `cr-${idx}`, name }));
  return sendResponse(res, HTTP_STATUS.OK, "Chatroom summary retrieved", rooms);
};

router.get("/new-chatroom/list/summary", handleChatroomSummary);
router.get("/list/summary", handleChatroomSummary);

router.delete("/new-chatroom/:chatroomId/delete", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Chatroom deleted successfully");
});
router.delete("/:chatroomId/delete", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Chatroom deleted successfully");
});

// Voice Rooms Endpoints (Support router mounted at /chat or /voice-room)
const handleVoiceRoomsList = (req, res) => {
  const groupIdOrCode = req.params.roomId || '';
  const storedVoiceRooms = groupIdOrCode ? getChannelsForGroup(groupIdOrCode, 'voice') : [];
  const rooms = storedVoiceRooms.map((name, idx) => ({
    id: `vr-${idx}`,
    name,
    janusRoomId: String(1000 + idx),
  }));
  return sendResponse(res, HTTP_STATUS.OK, "Voice rooms list retrieved", rooms);
};

router.get("/voice-room/list/:roomId", handleVoiceRoomsList);
router.get("/list/:roomId", handleVoiceRoomsList);
router.get("/voice-room/list", handleVoiceRoomsList);
router.get("/list", handleVoiceRoomsList);

const handleVoiceRoomCreate = (req, res) => {
  const roomName = req.query.roomName || req.body?.roomName || "voice-room";
  const chatRoomId = req.query.chatRoomId || req.body?.chatRoomId;
  if (chatRoomId && roomName) {
    addChannelToGroupInStorage(chatRoomId, roomName, "voice");
  }
  return sendResponse(res, HTTP_STATUS.CREATED, "Voice room created successfully", {
    id: `vr-${Date.now()}`,
    name: roomName,
    chatRoomId: chatRoomId,
  });
};

router.post("/voice-room/create", handleVoiceRoomCreate);

const handleVoiceRoomDelete = (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Voice room deleted successfully");
};

router.delete("/voice-room/delete", handleVoiceRoomDelete);

const handleVoiceRoomJoin = (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Joined voice room successfully", {
    janusRoomId: req.query.janusRoomId || req.body?.janusRoomId || "1234",
    displayName: req.query.displayName || req.body?.displayName,
  });
};

router.post("/voice-room/join", handleVoiceRoomJoin);

export default router;
