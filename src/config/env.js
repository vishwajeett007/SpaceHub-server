import "dotenv/config";

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  JWT_SECRET: process.env.JWT_SECRET || "spacehub_secret_key_change_me_in_prod",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  FRONTEND_URL: process.env.CLIENT_URL || "http://localhost:5173",
  REDIS_URL: process.env.REDIS_URL?.trim() || undefined,
  REDIS_REQUIRED: process.env.REDIS_REQUIRED === "true",
  REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX?.trim() || "spacehub:",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME?.trim() || undefined,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY?.trim() || undefined,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET?.trim() || undefined,
  CLOUDINARY_URL: process.env.CLOUDINARY_URL?.trim() || undefined,
};
