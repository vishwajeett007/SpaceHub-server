import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import communityRoutes from "./modules/communities/community.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import socialRoutes from "./modules/social/social.routes.js";
import webrtcRoutes from "./modules/webrtc/webrtc.routes.js";
import { protect } from "./shared/middlewares/authMiddleware.js";
import { sendResponse } from "./shared/utils/apiResponse.js";
import { HTTP_STATUS } from "./shared/constants/httpStatusCodes.js";
import { getChannelsForGroup, addChannelToGroupInStorage } from "./modules/communities/communityRoomsStorage.js";

const router = Router();

// ── Canonical module mounts ──
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/communities", communityRoutes);
router.use("/chat", chatRoutes);
router.use("/social", socialRoutes);
router.use("/webrtc", webrtcRoutes);

// ── Alias mounts for frontend compatibility ──

// Auth routes at root (register, login, forgot-password, etc.)
router.use("/", authRoutes);

// User/Profile routes
router.use("/profile", userRoutes);
router.use("/dashboard", userRoutes);
router.use("/files", userRoutes);

// Community routes
router.use("/community", communityRoutes);
router.use("/local-group", communityRoutes);
router.use("/localgroup", communityRoutes);

// Chat routes (new-chatroom, rooms)
router.use("/new-chatroom", chatRoutes);
router.use("/rooms", chatRoutes);

// Social routes at root so /search, /friends/*, /notifications/*, /messages/* all resolve
router.use("/", socialRoutes);

// ── Voice Room routes (separate to avoid /create conflict with chatroom) ──
const voiceRoomRouter = Router();
voiceRoomRouter.use(protect);

// Helper: Generate a unique janusRoomId scoped to group + room name
const generateJanusRoomId = (groupId, roomName) => {
  const combined = `${groupId || ''}::${roomName || ''}`;
  const hash = combined.split('').reduce((acc, char) => {
    acc = ((acc << 5) - acc) + char.charCodeAt(0);
    return acc & acc; // Convert to 32bit integer
  }, 0);
  return `vr_${groupId}_${Math.abs(hash).toString(36)}`;
};

voiceRoomRouter.get("/list/:roomId", (req, res) => {
  const groupIdOrCode = req.params.roomId || '';
  const storedVoiceRooms = groupIdOrCode ? getChannelsForGroup(groupIdOrCode, 'voice') : [];
  const rooms = storedVoiceRooms.map((name, idx) => {
    return {
      id: `vr-${idx}`,
      name,
      janusRoomId: generateJanusRoomId(groupIdOrCode, name),
      chatRoomId: groupIdOrCode,
      active: true,
    };
  });
  return sendResponse(res, HTTP_STATUS.OK, "Voice rooms list retrieved", rooms);
});

voiceRoomRouter.get("/list", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Voice rooms list retrieved", []);
});

voiceRoomRouter.post("/create", (req, res) => {
  const roomName = req.query.roomName || req.body?.roomName || "voice-room";
  const chatRoomId = req.query.chatRoomId || req.body?.chatRoomId;
  if (chatRoomId && roomName) {
    addChannelToGroupInStorage(chatRoomId, roomName, "voice");
  }
  const janusRoomId = generateJanusRoomId(chatRoomId, roomName);
  return sendResponse(res, HTTP_STATUS.CREATED, "Voice room created successfully", {
    id: `vr-${Date.now()}`,
    name: roomName,
    janusRoomId: janusRoomId,
    chatRoomId: chatRoomId,
    active: true,
  });
});

voiceRoomRouter.delete("/delete", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Voice room deleted successfully");
});

voiceRoomRouter.post("/join", (req, res) => {
  const janusRoomId = req.query.janusRoomId || req.body?.janusRoomId || "1234";
  const displayName = req.query.displayName || req.body?.displayName || "Member";
  const now = Date.now();
  const sessionId = Math.floor(now / 1000);
  const handleId = Math.floor(now % 1000000);

  return sendResponse(res, HTTP_STATUS.OK, "Joined voice room successfully", {
    janusRoomId: String(janusRoomId),
    sessionId: sessionId,
    handleId: handleId,
    userId: displayName,
    displayName: displayName,
  });
});

router.use("/voice-room", voiceRoomRouter);

export default router;
