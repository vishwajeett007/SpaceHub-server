import * as authService from "./auth.service.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const registerHandler = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.cookie("token", result.token, COOKIE_OPTIONS);
    return sendResponse(res, HTTP_STATUS.CREATED, "User registered successfully", result);
  } catch (error) {
    next(error);
  }
};

export const loginHandler = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.cookie("token", result.token, COOKIE_OPTIONS);
    return sendResponse(res, HTTP_STATUS.OK, "Logged in successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getMeHandler = async (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Current user fetched successfully", { user: req.user });
};

export const logoutHandler = async (req, res) => {
  res.clearCookie("token", COOKIE_OPTIONS);
  return sendResponse(res, HTTP_STATUS.OK, "Logged out successfully");
};
