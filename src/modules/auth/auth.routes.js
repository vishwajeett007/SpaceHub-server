import { Router } from "express";
import { registerHandler, loginHandler, getMeHandler, logoutHandler } from "./auth.controller.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendForgotOtpSchema,
  resendRegisterOtpSchema,
  resetPasswordSchema,
  validateForgotOtpSchema,
  validateRegisterOtpSchema,
} from "./auth.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import {
  requestPasswordReset,
  resendForgotPasswordOtp,
  resendOtp,
  resetPassword,
  verifyForgotPasswordOtp,
  verifyRegisterOtp,
} from "./auth.service.js";

const router = Router();

router.post("/register", validateRequest(registerSchema), registerHandler);
router.post("/login", validateRequest(loginSchema), loginHandler);

router.get("/me", protect, getMeHandler);
router.post("/logout", protect, logoutHandler);

router.post("/forgot-password", validateRequest(forgotPasswordSchema), async (req, res, next) => {
  try {
    const result = await requestPasswordReset(req.body.email || req.body.identifier);
    return sendResponse(res, HTTP_STATUS.OK, "Password reset OTP sent to your email", result);
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", validateRequest(resetPasswordSchema), async (req, res, next) => {
  try {
    const result = await resetPassword(req.body);
    return sendResponse(res, HTTP_STATUS.OK, "Password updated successfully", result);
  } catch (error) {
    next(error);
  }
});

router.post("/validate-forgot-otp", validateRequest(validateForgotOtpSchema), async (req, res, next) => {
  try {
    const result = await verifyForgotPasswordOtp(req.body);
    return sendResponse(res, HTTP_STATUS.OK, "OTP validated successfully", result);
  } catch (error) {
    next(error);
  }
});

router.post("/validate-register-otp", validateRequest(validateRegisterOtpSchema), async (req, res, next) => {
  try {
    await verifyRegisterOtp({
      identifier: req.body.identifier,
      email: req.body.email,
      otp: req.body.otp,
      sessionToken: req.body.sessionToken,
    });
    return sendResponse(res, HTTP_STATUS.OK, "Registration OTP validated", { valid: true });
  } catch (error) {
    next(error);
  }
});

router.post("/resend-otp", validateRequest(resendRegisterOtpSchema), async (req, res, next) => {
  try {
    const email = req.body.identifier || req.body.email;
    await resendOtp(email, req.body.sessionToken);
    return sendResponse(res, HTTP_STATUS.OK, "Registration OTP resent successfully");
  } catch (error) {
    next(error);
  }
});

router.post("/resend-forgot-otp", validateRequest(resendForgotOtpSchema), async (req, res, next) => {
  try {
    await resendForgotPasswordOtp(req.body.tempToken);
    return sendResponse(res, HTTP_STATUS.OK, "Password reset OTP resent successfully");
  } catch (error) {
    next(error);
  }
});

export default router;
