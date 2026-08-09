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
  getCommunityMembersHandler,
} from "./community.controller.js";
import { createCommunitySchema } from "./community.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import {
  getRoomsForCommunity,
  saveRoomForCommunity,
  deleteRoomForCommunity,
} from "./communityRoomsStorage.js";
import { prisma } from "../../config/prisma.js";
import { ROLES } from "../../shared/constants/roles.js";
import { AppError } from "../../shared/errors/AppError.js";

const router = Router();

// Public Community Listings & Search
router.get("/", getCommunitiesHandler);
router.get("/all", getCommunitiesHandler);
router.get("/discover", getCommunitiesHandler);
router.get("/search", getCommunitiesHandler);

// Public Local Group Listings
router.get("/local-group/all", getCommunitiesHandler);
router.get("/local-group/:groupId", getCommunityBySlugHandler);
router.get("/local-group/:groupId/members", getCommunityMembersHandler);
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
router.post("/members", getCommunityMembersHandler);
router.get("/:communityId/members", getCommunityMembersHandler);
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
router.get("/:communityId/rooms/all", async (req, res, next) => {
  try {
    const rooms = await getRoomsForCommunity(req.params.communityId);
    return sendResponse(res, HTTP_STATUS.OK, "Community rooms retrieved", rooms);
  } catch (err) {
    next(err);
  }
});

router.post("/:communityId/rooms/create", async (req, res, next) => {
  try {
    const communityId = req.params.communityId;
    const roomName = req.body.roomName || "New Group";

    if (req.user && communityId) {
      const community = await prisma.community.findUnique({ where: { id: communityId } });
      const member = await prisma.communityMember.findUnique({
        where: { userId_communityId: { userId: req.user.id, communityId } },
      });

      const isOwner = community && community.ownerId === req.user.id;
      const isAdmin = member && (member.role === ROLES.ADMIN || member.role === ROLES.OWNER);

      if (!isOwner && !isAdmin) {
        throw new AppError("Only community admins and owners can create groups", HTTP_STATUS.FORBIDDEN);
      }
    }

    const existingRooms = await getRoomsForCommunity(communityId);
    let room = existingRooms.find((r) => (r.name || r.roomName || '').toLowerCase() === roomName.toLowerCase());
    if (!room) {
      room = {
        id: `group-${Date.now()}`,
        name: roomName,
        roomName: roomName,
        roomCode: `ROOM-${Math.floor(1000 + Math.random() * 9000)}`,
        chatRooms: [],
        voiceRooms: [],
      };
      await saveRoomForCommunity(communityId, room);
    }
    
    return sendResponse(res, HTTP_STATUS.CREATED, "Room created inside community", room);
  } catch (error) {
    next(error);
  }
});

router.delete("/:communityId/rooms/:roomId", async (req, res, next) => {
  try {
    const communityId = req.params.communityId;
    const roomId = req.params.roomId;
    await deleteRoomForCommunity(communityId, roomId);
    return sendResponse(res, HTTP_STATUS.OK, "Community room deleted");
  } catch (err) {
    next(err);
  }
});

// Slug route MUST come last to avoid swallowing defined paths
router.get("/:slug", getCommunityBySlugHandler);

export default router;
