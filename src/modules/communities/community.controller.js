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
    // Local groups are private communities (isPrivate: true)
    const groups = await communityService.getUserJoinedCommunities(userId, true);
    return sendResponse(res, HTTP_STATUS.OK, "Local groups retrieved", groups);
  } catch (error) {
    next(error);
  }
};

export const getCommunityBySlugHandler = async (req, res, next) => {
  try {
    const community = await communityService.getCommunityBySlug(req.params.slug);
    return sendResponse(res, HTTP_STATUS.OK, "Community details retrieved", community);
  } catch (error) {
    next(error);
  }
};

export const joinCommunityHandler = async (req, res, next) => {
  try {
    const membership = await communityService.joinCommunity(req.user.id, req.params.id);
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
    const members = await communityService.getCommunityMembers(identifier);
    return sendResponse(res, HTTP_STATUS.OK, "Community members retrieved", { members });
  } catch (error) {
    next(error);
  }
};
