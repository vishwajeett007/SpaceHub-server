import { Router } from "express";
import { getProfileHandler, updateProfileHandler } from "./user.controller.js";
import { updateProfileSchema } from "./user.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

const router = Router();

router.use(protect);

// Profile Retrieval & Update
router.get("/profile", getProfileHandler);
router.get("/getProfile", getProfileHandler);

router.patch("/profile", validateRequest(updateProfileSchema), updateProfileHandler);
router.put("/profile", validateRequest(updateProfileSchema), updateProfileHandler);
router.put("/updateProfile", validateRequest(updateProfileSchema), updateProfileHandler);

router.post("/set-username", updateProfileHandler);

// Avatar & Cover Uploads
router.post("/avatar", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Avatar uploaded successfully", {
    avatarUrl: req.user.avatarUrl || "https://spacehub.monu14.me/default-avatar.png",
  });
});

router.post("/cover", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Cover photo uploaded successfully", {
    coverUrl: "https://spacehub.monu14.me/default-cover.png",
  });
});

// File Uploads & Download URLs
router.post("/upload-and-get-url", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "File uploaded successfully", {
    fileKey: "files/sample-file.png",
    fileUrl: "https://spacehub.monu14.me/files/sample-file.png",
    fileName: "sample-file.png",
  });
});

router.post("/presigned/download", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Presigned download URL generated", {
    url: "https://spacehub.monu14.me/files/sample-file.png",
  });
});

// Welcome Email & Account Delete
router.post("/send-email", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Welcome email sent successfully");
});

router.delete("/delete", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Account deleted successfully");
});

export default router;
