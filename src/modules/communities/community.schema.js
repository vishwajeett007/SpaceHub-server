import { z } from "zod";

export const createCommunitySchema = z.object({
  name: z.string().min(2, "Community name must be at least 2 characters long"),
  description: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  isPrivate: z.boolean().optional().default(false),
});
