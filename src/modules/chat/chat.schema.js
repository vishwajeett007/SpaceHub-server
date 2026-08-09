import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content cannot be empty"),
  channelId: z.string().uuid().optional(),
  receiverId: z.string().uuid().optional(),
});
