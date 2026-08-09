import { Router } from "express";
import { registerHandler, loginHandler, getMeHandler, logoutHandler } from "./auth.controller.js";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import { verifyRegisterOtp, resendOtp } from "./auth.service.js";

const router = Router();

// Registration & Login
router.post("/register", validateRequest(registerSchema), registerHandler);
router.post("/login", validateRequest(loginSchema), loginHandler);

// Current User & Logout
router.get("/me", protect, getMeHandler);
router.post("/logout", protect, logoutHandler);

// Forgot & Reset Password
const handleForgotPassword = (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Password reset link/code sent to your email", { email: req.body.email || req.body.identifier });
};

const handleResetPassword = (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Password updated successfully");
};

router.post("/forgot-password", validateRequest(forgotPasswordSchema), handleForgotPassword);
router.post("/reset-password", validateRequest(resetPasswordSchema), handleResetPassword);

// OTP Verification & Resend Endpoints
router.post("/validate-forgot-otp", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "OTP validated successfully", { valid: true });
});

router.post("/validate-register-otp", async (req, res, next) => {
  try {
    await verifyRegisterOtp({
      identifier: req.body.identifier,
      email: req.body.email,
      otp: req.body.otp,
    });
    return sendResponse(res, HTTP_STATUS.OK, "Registration OTP validated", { valid: true });
  } catch (error) {
    next(error);
  }
});

router.post("/resend-otp", async (req, res, next) => {
  try {
    const email = req.body.identifier || req.body.email;
    await resendOtp(email);
    return sendResponse(res, HTTP_STATUS.OK, "Registration OTP resent successfully");
  } catch (error) {
    next(error);
  }
});

router.post("/resend-forgot-otp", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Password reset OTP resent successfully");
});

export default router;
