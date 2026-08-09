import * as userService from "./user.service.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

export const getProfileHandler = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.id);
    return sendResponse(res, HTTP_STATUS.OK, "User profile retrieved successfully", user);
  } catch (error) {
    next(error);
  }
};

export const updateProfileHandler = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateUserProfile(req.user.id, req.body);
    return sendResponse(res, HTTP_STATUS.OK, "Profile updated successfully", updatedUser);
  } catch (error) {
    next(error);
  }
};

export const deleteAccountHandler = async (req, res, next) => {
  try {
    const { currentPassword } = req.body;
    await userService.deleteUserAccount(req.user.id, currentPassword);
    return sendResponse(res, HTTP_STATUS.OK, "Account deleted successfully");
  } catch (error) {
    next(error);
  }
};
