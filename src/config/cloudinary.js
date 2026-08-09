import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";
import fs from "node:fs";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const isCloudinaryConfigured = () => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;
  return Boolean(cloudName && apiKey && apiSecret);
};

export const uploadFileToCloudinary = async (fileInput, folder = "spacehub") => {
  if (!isCloudinaryConfigured()) {
    console.warn("Cloudinary is not configured. Skipping cloud upload.");
    return null;
  }

  try {
    // If fileInput is a multer file object with memory buffer
    if (fileInput && fileInput.buffer) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "auto" },
          (error, result) => {
            if (error) {
              console.error("Cloudinary stream error:", error);
              return reject(error);
            }
            resolve(result.secure_url);
          }
        );
        stream.end(fileInput.buffer);
      });
    }

    // If fileInput is a file path string or file object with path
    const filePath = typeof fileInput === "string" ? fileInput : fileInput?.path;
    if (filePath && fs.existsSync(filePath)) {
      const result = await cloudinary.uploader.upload(filePath, {
        folder,
        resource_type: "auto",
      });
      return result.secure_url;
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }

  return null;
};

export default cloudinary;
