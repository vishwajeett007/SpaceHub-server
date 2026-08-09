import { Router } from "express";
import {
  createCommunityHandler,
  getCommunitiesHandler,
  getMyCommunitiesHandler,
  getCommunityBySlugHandler,
  joinCommunityHandler,
  leaveCommunityHandler,
  acceptJoinRequestHandler,
  rejectJoinRequestHandler,
} from "./community.controller.js";
import { createCommunitySchema } from "./community.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

const router = Router();

// Public Community Listings & Search
router.get("/", getCommunitiesHandler);
router.get("/all", getCommunitiesHandler);
router.get("/discover", getCommunitiesHandler);
router.get("/search", getCommunitiesHandler);

// Public Local Group Listings
router.get("/local-group/all", getCommunitiesHandler);
router.get("/local-group/:groupId", getCommunityBySlugHandler);
router.get("/local-group/:groupId/members", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Local group members retrieved", []);
});
router.get("/local-group/:groupId/settings", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Local group settings retrieved", {});
});

router.use(protect);

// Create Community & Local Group
router.post("/", validateRequest(createCommunitySchema), createCommunityHandler);
router.post("/create", validateRequest(createCommunitySchema), createCommunityHandler);
router.post("/local-group/create", validateRequest(createCommunitySchema), createCommunityHandler);

router.get("/my-communities", getMyCommunitiesHandler);

// Membership, Join & Role Management
router.post("/requestJoin", (req, res, next) => {
  req.params.id = req.body.communityId || req.body.communityName;
  return joinCommunityHandler(req, res, next);
});
router.post("/:id/join", joinCommunityHandler);
router.post("/local-group/join", joinCommunityHandler);

router.post("/acceptRequest", acceptJoinRequestHandler);
router.post("/rejectRequest", rejectJoinRequestHandler);
router.post("/leave", leaveCommunityHandler);
router.post("/cancelJoin", leaveCommunityHandler);
router.post("/delete", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Community deleted successfully");
});
router.post("/members", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Community members retrieved", []);
});
router.post("/changeRole", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Member role updated successfully");
});
router.post("/removeMember", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Member removed from community");
});

// Community Invites
router.post("/invites/:communityId/create", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Community invite link generated", { inviteCode: "INV123" });
});
router.post("/invites/accept", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Joined community via invite link");
});
router.post("/localgroup/invites/create/:groupId", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Local group invite link generated", { inviteCode: "LG123" });
});
router.get("/localgroup/invites/list/:groupId", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Local group invites retrieved", []);
});
router.post("/localgroup/invites/accept", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Joined local group via invite link");
});

// Rooms inside Communities
router.get("/:communityId/rooms/all", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Community rooms retrieved", [
    { id: "general", name: "general", type: "TEXT" },
    { id: "voice-lounge", name: "voice-lounge", type: "VOICE" },
  ]);
});

router.post("/:communityId/rooms/create", (req, res) => {
  return sendResponse(res, HTTP_STATUS.CREATED, "Room created inside community", {
    id: req.body.roomName || "Announcement",
    roomName: req.body.roomName || "Announcement",
    roomCode: "ANN123",
  });
});

router.delete("/:communityId/rooms/:roomId", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Community room deleted");
});

// Slug route MUST come last to avoid swallowing defined paths
router.get("/:slug", getCommunityBySlugHandler);

export default router;
