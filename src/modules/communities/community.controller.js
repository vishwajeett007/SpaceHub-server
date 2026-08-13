import * as communityService from "./community.service.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

export const createCommunityHandler = async (req, res, next) => {
  try {
    const community = await communityService.createCommunity(req.user.id, req.body);
    return sendResponse(res, HTTP_STATUS.CREATED, "Community created successfully", community);
  } catch (error) {
    next(error);
  }
};

export const getCommunitiesHandler = async (req, res, next) => {
  try {
    const communities = await communityService.getAllPublicCommunities();
    return sendResponse(res, HTTP_STATUS.OK, "Public communities retrieved", communities);
  } catch (error) {
    next(error);
  }
};

export const discoverCommunitiesHandler = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 0, 0);
    const size = Math.min(Math.max(Number.parseInt(req.query.size, 10) || 20, 1), 50);
    const communities = await communityService.getAllPublicCommunities({
      skip: page * size,
      take: size,
    });
    return sendResponse(res, HTTP_STATUS.OK, "Public communities retrieved", communities);
  } catch (error) {
    next(error);
  }
};

export const searchCommunitiesHandler = async (req, res, next) => {
  try {
    const query = String(req.query.q || req.query.query || "").trim();
    const page = Math.max(Number.parseInt(req.query.page, 10) || 0, 0);
    const size = Math.min(Math.max(Number.parseInt(req.query.size, 10) || 20, 1), 50);
    const communities = await communityService.getAllPublicCommunities({
      query,
      skip: page * size,
      take: size,
    });
    return sendResponse(res, HTTP_STATUS.OK, "Community search results retrieved", communities);
  } catch (error) {
    next(error);
  }
};

export const getMyCommunitiesHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, HTTP_STATUS.OK, "Joined communities retrieved", []);
    }
    const isPrivateFilter = req.query.isPrivate === 'true' ? true : req.query.isPrivate === 'false' ? false : null;
    const communities = await communityService.getUserJoinedCommunities(userId, isPrivateFilter);
    return sendResponse(res, HTTP_STATUS.OK, "Joined communities retrieved", communities);
  } catch (error) {
    next(error);
  }
};

export const getLocalGroupsHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, HTTP_STATUS.OK, "Local groups retrieved", []);
    }

    const groups = await communityService.getUserJoinedCommunities(userId, true);
    return sendResponse(res, HTTP_STATUS.OK, "Local groups retrieved", groups);
  } catch (error) {
    next(error);
  }
};

export const getCommunityBySlugHandler = async (req, res, next) => {
  try {
    const identifier = req.params.slug || req.params.groupId || req.params.communityId || req.params.id;
    const community = await communityService.getCommunityBySlug(identifier);
    if (community.isPrivate) {
      await communityService.assertCommunityMember(community.id, req.user?.id);
    }
    return sendResponse(res, HTTP_STATUS.OK, "Community details retrieved", community);
  } catch (error) {
    next(error);
  }
};

export const joinCommunityHandler = async (req, res, next) => {
  try {
    const identifier = req.params.id
      || req.body.communityId
      || req.body.groupId
      || req.body.communityName;
    const membership = await communityService.joinCommunity(req.user.id, identifier);
    return sendResponse(res, HTTP_STATUS.OK, "Successfully joined community", membership);
  } catch (error) {
    next(error);
  }
};

export const leaveCommunityHandler = async (req, res, next) => {
  try {
    const identifier = req.body.communityId || req.body.communityName || req.params.id;
    const result = await communityService.leaveCommunity(req.user.id, identifier);
    return sendResponse(res, HTTP_STATUS.OK, "Left community / cancelled request successfully", result);
  } catch (error) {
    next(error);
  }
};

export const acceptJoinRequestHandler = async (req, res, next) => {
  try {
    const result = await communityService.acceptCommunityJoinRequest(req.user.id, req.body);
    return sendResponse(res, HTTP_STATUS.OK, "Join request accepted", result);
  } catch (error) {
    next(error);
  }
};

export const rejectJoinRequestHandler = async (req, res, next) => {
  try {
    const result = await communityService.rejectCommunityJoinRequest(req.user.id, req.body);
    return sendResponse(res, HTTP_STATUS.OK, "Join request rejected", result);
  } catch (error) {
    next(error);
  }
};

export const getCommunityMembersHandler = async (req, res, next) => {
  try {
    const identifier = req.params.groupId || req.params.communityId || req.body.communityId || req.body.groupId || req.query.communityId;
    await communityService.assertCommunityMember(identifier, req.user.id);
    const members = await communityService.getCommunityMembers(identifier);
    return sendResponse(res, HTTP_STATUS.OK, "Community members retrieved", { members });
  } catch (error) {
    next(error);
  }
};
