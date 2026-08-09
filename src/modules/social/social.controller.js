import * as socialService from "./social.service.js";
import { getPendingCommunityRequests } from "../communities/community.service.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

export const searchUsersHandler = async (req, res, next) => {
  try {
    const users = await socialService.searchUsers(req.query.query || "", req.user.id);
    return sendResponse(res, HTTP_STATUS.OK, "Users retrieved", users);
  } catch (error) {
    next(error);
  }
};

export const sendFriendRequestHandler = async (req, res, next) => {
  try {
    const friendIdentifier = req.body.friendId || req.body.friendEmail;
    const result = await socialService.sendFriendRequest(req.user.id, friendIdentifier);
    return sendResponse(res, HTTP_STATUS.CREATED, "Friend request sent", result);
  } catch (error) {
    next(error);
  }
};

export const cancelFriendRequestHandler = async (req, res, next) => {
  try {
    const friendIdentifier = req.body.friendId || req.body.friendEmail;
    const result = await socialService.cancelFriendRequest(req.user.id, friendIdentifier);
    return sendResponse(res, HTTP_STATUS.OK, "Friend request cancelled", result);
  } catch (error) {
    next(error);
  }
};

export const getFriendsListHandler = async (req, res, next) => {
  try {
    const friends = await socialService.getFriendsList(req.user.id);
    return sendResponse(res, HTTP_STATUS.OK, "Friends list retrieved", friends);
  } catch (error) {
    next(error);
  }
};

export const getNotificationsHandler = async (req, res, next) => {
  try {
    const friendRequests = await socialService.getPendingFriendRequests(req.user.id);
    const communityRequests = await getPendingCommunityRequests(req.user.id);
    return sendResponse(res, HTTP_STATUS.OK, "Notifications retrieved", {
      friendRequests,
      communityRequests,
    });
  } catch (error) {
    next(error);
  }
};

export const respondFriendRequestHandler = async (req, res, next) => {
  try {
    const requesterIdentifier = req.body.requesterEmail || req.body.requesterId || req.body.referenceId;
    const result = await socialService.respondToFriendRequest(
      req.user.id,
      requesterIdentifier,
      req.body.accept
    );
    return sendResponse(res, HTTP_STATUS.OK, "Friend request responded", result);
  } catch (error) {
    next(error);
  }
};

export const removeFriendHandler = async (req, res, next) => {
  try {
    const result = await socialService.removeFriend(req.user.id, req.body.friendEmail);
    return sendResponse(res, HTTP_STATUS.OK, "Friend removed", result);
  } catch (error) {
    next(error);
  }
};
