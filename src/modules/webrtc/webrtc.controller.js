import * as webrtcService from "./webrtc.service.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

export const joinVoiceRoomHandler = async (req, res, next) => {
  try {
    const session = await webrtcService.getOrCreateVoiceSession(req.body.roomId, req.user.id);
    return sendResponse(res, HTTP_STATUS.OK, "Joined WebRTC voice room", session);
  } catch (error) {
    next(error);
  }
};

export const getVoiceRoomParticipantsHandler = async (req, res, next) => {
  try {
    const participants = await webrtcService.getVoiceRoomParticipants(req.params.roomId);
    return sendResponse(res, HTTP_STATUS.OK, "Voice room participants retrieved", participants);
  } catch (error) {
    next(error);
  }
};
