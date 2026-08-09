import { Router } from "express";
import {
  createCommunityHandler,
  getCommunitiesHandler,
  getMyCommunitiesHandler,
  getLocalGroupsHandler,
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
  renameRoomForCommunity,
} from "./communityRoomsStorage.js";
import * as communityService from "./community.service.js";
import { upload } from "../../shared/middlewares/uploadMiddleware.js";
import { uploadFileToCloudinary } from "../../config/cloudinary.js";
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
router.get("/local-group/all", getLocalGroupsHandler);
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
router.post("/delete", async (req, res, next) => {
  try {
    const { name, communityId } = req.body;
    const identifier = communityId || name;
    if (!identifier) {
      throw new AppError("Community identifier is required", HTTP_STATUS.BAD_REQUEST);
    }
    await communityService.deleteCommunityByNameOrId(identifier);
    return sendResponse(res, HTTP_STATUS.OK, "Community deleted successfully");
  } catch (err) {
    next(err);
  }
});
router.post("/members", getCommunityMembersHandler);
router.get("/:communityId/members", getCommunityMembersHandler);

router.post("/changeRole", async (req, res, next) => {
  try {
    const { communityId, targetUserEmail, newRole } = req.body;
    if (!communityId || !targetUserEmail || !newRole) {
      throw new AppError("communityId, targetUserEmail, and newRole are required", HTTP_STATUS.BAD_REQUEST);
    }
    const updated = await communityService.updateMemberRole(communityId, targetUserEmail, newRole);
    return sendResponse(res, HTTP_STATUS.OK, "Member role updated successfully", updated);
  } catch (err) {
    next(err);
  }
});

router.post("/removeMember", async (req, res, next) => {
  try {
    const { communityId, targetUserEmail } = req.body;
    if (!communityId || !targetUserEmail) {
      throw new AppError("communityId and targetUserEmail are required", HTTP_STATUS.BAD_REQUEST);
    }
    await communityService.removeMemberFromCommunity(communityId, targetUserEmail);
    return sendResponse(res, HTTP_STATUS.OK, "Member removed from community");
  } catch (err) {
    next(err);
  }
});

router.post("/:communityId/upload-banner", upload.any(), async (req, res, next) => {
  try {
    const communityId = req.params.communityId;
    const body = req.body || {};
    const name = body.name;
    const description = body.description;

    let avatarUrl;
    let bannerUrl;

    if (Array.isArray(req.files)) {
      const avatarFile = req.files.find((f) => f.fieldname === 'avatarFile');
      const imageFile = req.files.find((f) => f.fieldname === 'imageFile');
      if (avatarFile) {
        avatarUrl = await uploadFileToCloudinary(avatarFile, "communities/avatars");
      }
      if (imageFile) {
        bannerUrl = await uploadFileToCloudinary(imageFile, "communities/banners");
      }
    }

    const updated = await communityService.updateCommunityProfile(communityId, {
      name,
      description,
      avatarUrl,
      bannerUrl,
    });
    return sendResponse(res, HTTP_STATUS.OK, "Community profile updated successfully", updated);
  } catch (err) {
    next(err);
  }
});

// Community Invites
router.post("/invites/:communityId/create", (req, res) => {
  const communityId = req.params.communityId;
  const inviteCode = `INV_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const inviteLink = `${req.headers.origin || "http://localhost:5173"}/invite/${communityId}/${inviteCode}`;
  return sendResponse(res, HTTP_STATUS.OK, "Community invite link generated", { inviteCode, inviteLink });
});
router.post("/invites/accept", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Joined community via invite link");
});
router.post("/localgroup/invites/create/:groupId", (req, res) => {
  const groupId = req.params.groupId;
  const inviteCode = `LG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const inviteLink = `${req.headers.origin || "http://localhost:5173"}/localgroup/invite/${groupId}/${inviteCode}`;
  return sendResponse(res, HTTP_STATUS.OK, "Local group invite link generated", { inviteCode, inviteLink });
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

router.put("/:communityId/rooms/:roomId/rename", async (req, res, next) => {
  try {
    const { communityId, roomId } = req.params;
    const newRoomName = req.body.newRoomName || req.body.name;
    if (!newRoomName) {
      throw new AppError("New room name is required", HTTP_STATUS.BAD_REQUEST);
    }
    await renameRoomForCommunity(communityId, roomId, newRoomName);
    return sendResponse(res, HTTP_STATUS.OK, "Community room renamed successfully");
  } catch (err) {
    next(err);
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
