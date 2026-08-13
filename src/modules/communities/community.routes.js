import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  createCommunityHandler,
  discoverCommunitiesHandler,
  getCommunitiesHandler,
  getMyCommunitiesHandler,
  getLocalGroupsHandler,
  getCommunityBySlugHandler,
  joinCommunityHandler,
  leaveCommunityHandler,
  acceptJoinRequestHandler,
  rejectJoinRequestHandler,
  searchCommunitiesHandler,
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
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

const router = Router();

router.get("/", getCommunitiesHandler);
router.get("/all", getCommunitiesHandler);
router.get("/discover", discoverCommunitiesHandler);
router.get("/search", searchCommunitiesHandler);

router.use(protect);

router.get("/local-group/all", getLocalGroupsHandler);
router.get("/local-group/:groupId", async (req, res, next) => {
  try {
    await communityService.assertCommunityMember(req.params.groupId, req.user.id);
    return getCommunityBySlugHandler(req, res, next);
  } catch (error) {
    next(error);
  }
});
router.get("/local-group/:groupId/members", getCommunityMembersHandler);
router.get("/local-group/:groupId/join-requests", async (req, res, next) => {
  try {
    const community = await communityService.assertCommunityAdmin(req.params.groupId, req.user.id);
    const requests = await communityService.getPendingCommunityRequests(req.user.id);
    return sendResponse(
      res,
      HTTP_STATUS.OK,
      "Local group join requests retrieved",
      requests.filter((request) => request.communityId === community.id),
    );
  } catch (error) {
    next(error);
  }
});
router.get("/local-group/:groupId/settings", async (req, res, next) => {
  try {
    await communityService.assertCommunityMember(req.params.groupId, req.user.id);
    const group = await communityService.getCommunityBySlug(req.params.groupId);
    return sendResponse(res, HTTP_STATUS.OK, "Local group settings retrieved", group);
  } catch (error) {
    next(error);
  }
});

router.post("/", validateRequest(createCommunitySchema), createCommunityHandler);
router.post("/create", validateRequest(createCommunitySchema), createCommunityHandler);
router.post("/local-group/create", validateRequest(createCommunitySchema), (req, res, next) => {
  req.body.isPrivate = true;
  return createCommunityHandler(req, res, next);
});

router.get("/my-communities", getMyCommunitiesHandler);

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
    await communityService.deleteCommunityByNameOrId(req.user.id, identifier);
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
    const updated = await communityService.updateMemberRole(req.user.id, communityId, targetUserEmail, newRole);
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
    await communityService.removeMemberFromCommunity(req.user.id, communityId, targetUserEmail);
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

    const updated = await communityService.updateCommunityProfile(req.user.id, communityId, {
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

router.post("/invites/:communityId/create", async (req, res, next) => {
  try {
    const communityId = req.params.communityId;
    const invite = await communityService.createCommunityInvite(req.user.id, communityId, {
      expiresInHours: req.body.expiresInHours,
    });
    const inviteLink = `${env.FRONTEND_URL}/invite/${invite.communityId}/${encodeURIComponent(invite.inviteCode)}`;
    return sendResponse(res, HTTP_STATUS.OK, "Community invite link generated", { ...invite, inviteLink });
  } catch (error) {
    next(error);
  }
});
router.post("/invites/accept", async (req, res, next) => {
  try {
    const result = await communityService.acceptCommunityInvite(req.user.id, req.body);
    return sendResponse(res, HTTP_STATUS.OK, "Joined community via invite link", result);
  } catch (error) {
    next(error);
  }
});
router.post("/localgroup/invites/create/:groupId", async (req, res, next) => {
  try {
    const groupId = req.params.groupId;
    const invite = await communityService.createCommunityInvite(req.user.id, groupId, {
      isLocalGroup: true,
      expiresInHours: req.body.expiresInHours,
    });
    const inviteLink = `${env.FRONTEND_URL}/localgroup/invite/${invite.communityId}/${encodeURIComponent(invite.inviteCode)}`;
    return sendResponse(res, HTTP_STATUS.OK, "Local group invite link generated", { ...invite, inviteLink });
  } catch (error) {
    next(error);
  }
});
router.get("/localgroup/invites/list/:groupId", async (req, res, next) => {
  try {
    await communityService.assertCommunityAdmin(req.params.groupId, req.user.id);
    return sendResponse(res, HTTP_STATUS.OK, "Local group invites retrieved", []);
  } catch (error) {
    next(error);
  }
});
router.post("/localgroup/invites/accept", async (req, res, next) => {
  try {
    const result = await communityService.acceptCommunityInvite(req.user.id, req.body, { isLocalGroup: true });
    return sendResponse(res, HTTP_STATUS.OK, "Joined local group via invite link", result);
  } catch (error) {
    next(error);
  }
});

router.get("/:communityId/rooms/all", async (req, res, next) => {
  try {
    const community = await communityService.assertCommunityMember(req.params.communityId, req.user.id);
    const rooms = await getRoomsForCommunity(community.id);
    return sendResponse(res, HTTP_STATUS.OK, "Community rooms retrieved", rooms);
  } catch (err) {
    next(err);
  }
});

router.post("/:communityId/rooms/create", async (req, res, next) => {
  try {
    const communityId = req.params.communityId;
    const roomName = String(req.body.roomName || "New Group").trim();
    const community = await communityService.assertCommunityAdmin(communityId, req.user.id);
    if (!roomName) {
      throw new AppError("Room name is required", HTTP_STATUS.BAD_REQUEST);
    }

    const existingRooms = await getRoomsForCommunity(community.id);
    let room = existingRooms.find((r) => (r.name || r.roomName || '').toLowerCase() === roomName.toLowerCase());
    if (!room) {
      room = {
        id: randomUUID(),
        name: roomName,
        roomName: roomName,
        roomCode: `ROOM-${randomUUID()}`,
        chatRooms: [],
        voiceRooms: [],
      };
      await saveRoomForCommunity(community.id, room);
    }

    return sendResponse(res, HTTP_STATUS.CREATED, "Room created inside community", room);
  } catch (error) {
    next(error);
  }
});

router.put("/:communityId/rooms/:roomId/rename", async (req, res, next) => {
  try {
    const { communityId, roomId } = req.params;
    await communityService.assertCommunityAdmin(communityId, req.user.id);
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
    await communityService.assertCommunityAdmin(communityId, req.user.id);
    await deleteRoomForCommunity(communityId, roomId);
    return sendResponse(res, HTTP_STATUS.OK, "Community room deleted");
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", getCommunityBySlugHandler);

export default router;
