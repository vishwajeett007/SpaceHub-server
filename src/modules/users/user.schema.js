import { z } from "zod";

export const updateProfileSchema = z.object({
  username: z.string().min(3).optional(),
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  email: z.string().email().optional(),
});
