import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long").optional(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  identifier: z.string().optional(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  identifier: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  token: z.string().optional(),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});
