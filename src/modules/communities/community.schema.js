import { z } from "zod";

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2, "Community name must be at least 2 characters long").max(80),
  description: z.string().trim().max(1000).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  isPrivate: z.boolean().optional().default(false),
});
