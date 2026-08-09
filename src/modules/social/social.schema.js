import { z } from "zod";

export const friendRequestSchema = z.object({
  friendEmail: z.string().email("Invalid friend email").optional(),
  friendId: z.string().min(1, "Invalid friend ID").optional(),
}).refine((data) => data.friendEmail || data.friendId, {
  message: "Either friendEmail or friendId is required",
});

export const respondFriendRequestSchema = z.object({
  requesterEmail: z.string().optional(),
  requesterId: z.string().optional(),
  referenceId: z.string().optional(),
  accept: z.boolean(),
}).refine((data) => data.requesterEmail || data.requesterId || data.referenceId, {
  message: "Requester identifier is required",
});

export const sendFriendMessageSchema = z.object({
  friendEmail: z.string().email("Invalid friend email"),
  message: z.string().min(1, "Message cannot be empty"),
  images: z.array(z.string()).optional(),
});
