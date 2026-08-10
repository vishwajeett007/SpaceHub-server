import { Router } from "express";
import {
  searchUsersHandler,
  sendFriendRequestHandler,
  cancelFriendRequestHandler,
  getFriendsListHandler,
  getNotificationsHandler,
  respondFriendRequestHandler,
  removeFriendHandler,
} from "./social.controller.js";
import {
  friendRequestSchema,
  respondFriendRequestSchema,
} from "./social.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

import {
  getDirectMessagesFromStorage,
  saveDirectMessageToStorage,
} from "./directMessageStorage.js";

const router = Router();

router.use(protect);

router.get("/search", searchUsersHandler);

router.post("/friends/request", validateRequest(friendRequestSchema), sendFriendRequestHandler);
router.post("/request", validateRequest(friendRequestSchema), sendFriendRequestHandler);

router.post("/friends/cancel", validateRequest(friendRequestSchema), cancelFriendRequestHandler);
router.post("/cancel", validateRequest(friendRequestSchema), cancelFriendRequestHandler);

router.post("/friends/list", getFriendsListHandler);
router.get("/friends/list", getFriendsListHandler);
router.post("/list", getFriendsListHandler);
router.get("/list", getFriendsListHandler);

router.get("/friends/pending", getNotificationsHandler);

router.post("/friends/respond", validateRequest(respondFriendRequestSchema), respondFriendRequestHandler);
router.post("/respond", validateRequest(respondFriendRequestSchema), respondFriendRequestHandler);

router.post("/friends/remove", removeFriendHandler);
router.post("/remove", removeFriendHandler);

const handleSendMessage = async (req, res) => {
  const userEmail = req.user?.email || req.body.userEmail || req.body.senderEmail;
  const friendEmail = req.body.friendEmail || req.body.receiverEmail;

  const payload = {
    senderEmail: userEmail,
    receiverEmail: friendEmail,
    message: req.body.message || req.body.content || req.body.text || "",
    text: req.body.message || req.body.content || req.body.text || "",
    content: req.body.message || req.body.content || req.body.text || "",
    images: Array.isArray(req.body.images) ? req.body.images : [],
    fileKey: req.body.fileKey || req.body.file_key || null,
    fileUrl: req.body.fileUrl || req.body.file_url || null,
    fileName: req.body.fileName || req.body.file_name || null,
    contentType: req.body.contentType || req.body.content_type || null,
    type: req.body.type || (req.body.fileKey || req.body.fileUrl ? "FILE" : "message"),
  };

  const savedMessage = await saveDirectMessageToStorage(payload);

  return sendResponse(res, HTTP_STATUS.CREATED, "Friend message sent successfully", savedMessage || payload);
};

router.post("/friends/message/send", handleSendMessage);
router.post("/message/send", handleSendMessage);

const handleGetChatHistory = async (req, res) => {
  const user1 = req.query.user1 || req.query.senderEmail || req.query.userEmail || req.user?.email;
  const user2 = req.query.user2 || req.query.friendEmail || req.query.receiverEmail;

  const messages = await getDirectMessagesFromStorage(user1, user2);
  return sendResponse(res, HTTP_STATUS.OK, "Chat history retrieved", messages);
};

router.get("/friends/messages", handleGetChatHistory);
router.get("/messages/chat", handleGetChatHistory);

router.get("/notifications", getNotificationsHandler);
router.delete("/notifications/reference/:referenceId", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Notification deleted by reference ID");
});

export default router;
