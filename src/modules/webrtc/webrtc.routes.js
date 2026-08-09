import { Router } from "express";
import { joinVoiceRoomHandler, getVoiceRoomParticipantsHandler } from "./webrtc.controller.js";
import { joinVoiceRoomSchema } from "./webrtc.schema.js";
import { validateRequest } from "../../shared/middlewares/validateRequest.js";
import { protect } from "../../shared/middlewares/authMiddleware.js";

const router = Router();

router.use(protect);

router.post("/join", validateRequest(joinVoiceRoomSchema), joinVoiceRoomHandler);
router.get("/room/:roomId/participants", getVoiceRoomParticipantsHandler);

export default router;
