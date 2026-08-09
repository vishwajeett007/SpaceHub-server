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

voiceRoomRouter.get("/list/:roomId", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Voice rooms list retrieved", [
    { id: "vr-1", name: req.params.roomId || "voice-lounge", janusRoomId: "1234" },
  ]);
});

voiceRoomRouter.get("/list", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Voice rooms list retrieved", []);
});

voiceRoomRouter.post("/create", (req, res) => {
  return sendResponse(res, HTTP_STATUS.CREATED, "Voice room created successfully", {
    id: "vr-1",
    name: req.query.roomName || req.body?.roomName || "voice-lounge",
    chatRoomId: req.query.chatRoomId || req.body?.chatRoomId,
  });
});

voiceRoomRouter.delete("/delete", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Voice room deleted successfully");
});

voiceRoomRouter.post("/join", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Joined voice room successfully", {
    janusRoomId: req.query.janusRoomId || req.body?.janusRoomId || "1234",
    displayName: req.query.displayName || req.body?.displayName,
  });
});

router.use("/voice-room", voiceRoomRouter);

export default router;
