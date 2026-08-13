import { z } from "zod";

const optionalNameSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(2).max(50).regex(/^[A-Za-z]+$/).optional(),
);

export const registerSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters long").optional(),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[#@!%&]/, "Password must contain one of #, @, !, %, or &")
    .regex(/^\S+$/, "Password cannot contain spaces"),
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").optional(),
  identifier: z.string().trim().min(1, "Email or username is required").optional(),
  password: z.string().min(1, "Password is required"),
}).refine((data) => data.email || data.identifier, {
  message: "Email or username is required",
  path: ["identifier"],
});

export const validateRegisterOtpSchema = z.object({
  identifier: z.string().trim().email("Invalid email address").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
  sessionToken: z.string().min(1, "Registration session token is required"),
}).refine((data) => data.identifier || data.email, {
  message: "Email or identifier is required",
  path: ["identifier"],
});

export const resendRegisterOtpSchema = z.object({
  identifier: z.string().trim().email("Invalid email address").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  sessionToken: z.string().min(1, "Registration session token is required"),
}).refine((data) => data.identifier || data.email, {
  message: "Email or identifier is required",
  path: ["identifier"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address").optional(),
  identifier: z.string().trim().email("Invalid email address").optional(),
}).refine((data) => data.identifier || data.email, {
  message: "Email or identifier is required",
  path: ["identifier"],
});

export const validateForgotOtpSchema = z.object({
  identifier: z.string().trim().email("Invalid email address").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
  tempToken: z.string().min(1, "Password reset session token is required"),
}).refine((data) => data.identifier || data.email, {
  message: "Email or identifier is required",
  path: ["identifier"],
});

export const resendForgotOtpSchema = z.object({
  tempToken: z.string().min(1, "Password reset session token is required"),
});

export const resetPasswordSchema = z.object({
  identifier: z.string().trim().email("Invalid email address").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  token: z.string().optional(),
  tempToken: z.string().optional(),
  newPassword: z.string()
    .min(8, "New password must be at least 8 characters long")
    .regex(/[A-Z]/, "New password must contain an uppercase letter")
    .regex(/[0-9]/, "New password must contain a number")
    .regex(/[#@!%&]/, "New password must contain one of #, @, !, %, or &")
    .regex(/^\S+$/, "New password cannot contain spaces"),
}).refine((data) => data.identifier || data.email, {
  message: "Email or identifier is required",
  path: ["identifier"],
}).refine((data) => data.tempToken || data.token, {
  message: "Password reset token is required",
  path: ["tempToken"],
});
