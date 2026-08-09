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

const router = Router();

router.use(protect);

// User & Friend Search
router.get("/search", searchUsersHandler);

// Friends Management
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

// Direct Friend Messaging & Chat History
const handleSendMessage = (req, res) => {
  return sendResponse(res, HTTP_STATUS.CREATED, "Friend message sent successfully", {
    id: "msg-123",
    friendEmail: req.body.friendEmail,
    message: req.body.message,
    createdAt: new Date().toISOString(),
  });
};

router.post("/friends/message/send", handleSendMessage);
router.post("/message/send", handleSendMessage);

router.get("/friends/messages", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Friend messages retrieved", []);
});

router.get("/messages/chat", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Chat history retrieved", []);
});

// Notifications
router.get("/notifications", getNotificationsHandler);
router.delete("/notifications/reference/:referenceId", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Notification deleted by reference ID");
});

export default router;
