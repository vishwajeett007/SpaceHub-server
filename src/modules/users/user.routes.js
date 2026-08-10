import { Router } from "express";
import { getProfileHandler, updateProfileHandler, deleteAccountHandler } from "./user.controller.js";
import { updateProfileSchema } from "./user.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import { upload } from "../../shared/middlewares/uploadMiddleware.js";
import { uploadFileToCloudinary } from "../../config/cloudinary.js";
import * as userService from "./user.service.js";

const router = Router();

router.use(protect);

router.get("/profile", getProfileHandler);
router.get("/getProfile", getProfileHandler);

router.patch("/profile", validateRequest(updateProfileSchema), updateProfileHandler);
router.put("/profile", validateRequest(updateProfileSchema), updateProfileHandler);
router.put("/updateProfile", validateRequest(updateProfileSchema), updateProfileHandler);

router.post("/set-username", updateProfileHandler);

router.post("/avatar", upload.single("file"), async (req, res, next) => {
  try {
    let avatarUrl = req.user.avatarUrl;
    if (req.file) {
      const cloudUrl = await uploadFileToCloudinary(req.file, "avatars");
      if (cloudUrl) {
        avatarUrl = cloudUrl;
        await userService.updateUserProfile(req.user.id, { avatarUrl });
      }
    }
    return sendResponse(res, HTTP_STATUS.OK, "Avatar uploaded successfully", {
      avatarUrl,
      avatarPreviewUrl: avatarUrl,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/cover", upload.single("file"), async (req, res, next) => {
  try {
    let coverUrl = null;
    if (req.file) {
      coverUrl = await uploadFileToCloudinary(req.file, "covers");
    }
    return sendResponse(res, HTTP_STATUS.OK, "Cover photo uploaded successfully", {
      coverUrl,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/upload-and-get-url", upload.single("file"), async (req, res, next) => {
  try {
    let fileUrl = "https://spacehub.monu14.me/files/sample-file.png";
    if (req.file) {
      const cloudUrl = await uploadFileToCloudinary(req.file, "files");
      if (cloudUrl) fileUrl = cloudUrl;
    }
    return sendResponse(res, HTTP_STATUS.OK, "File uploaded successfully", {
      fileKey: req.file ? req.file.originalname : "files/sample-file.png",
      fileUrl,
      fileName: req.file ? req.file.originalname : "sample-file.png",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/presigned/download", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Presigned download URL generated", {
    url: "https://spacehub.monu14.me/files/sample-file.png",
  });
});

router.post("/send-email", (req, res) => {
  return sendResponse(res, HTTP_STATUS.OK, "Welcome email sent successfully");
});

router.delete("/delete", deleteAccountHandler);

export default router;
