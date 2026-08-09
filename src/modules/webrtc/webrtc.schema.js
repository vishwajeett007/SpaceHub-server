import { z } from "zod";

export const joinVoiceRoomSchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
  communityId: z.string().optional(),
});

export const signalingOfferSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
  roomId: z.string().min(1, "Room ID is required"),
  sdp: z.string().min(1, "SDP is required"),
});

export const signalingAnswerSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
  roomId: z.string().min(1, "Room ID is required"),
  sdp: z.string().min(1, "SDP is required"),
});

export const iceCandidateSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
  roomId: z.string().min(1, "Room ID is required"),
  candidate: z.any(),
});
