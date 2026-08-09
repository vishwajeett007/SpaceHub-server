import * as chatService from "./chat.service.js";
import { sendResponse } from "../../shared/utils/apiResponse.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

export const getChannelMessagesHandler = async (req, res, next) => {
  try {
    const messages = await chatService.getChannelMessages(req.params.channelId);
    return sendResponse(res, HTTP_STATUS.OK, "Channel messages retrieved", messages);
  } catch (error) {
    next(error);
  }
};

export const getDirectMessagesHandler = async (req, res, next) => {
  try {
    const messages = await chatService.getDirectMessages(req.user.id, req.params.userId);
    return sendResponse(res, HTTP_STATUS.OK, "Direct messages retrieved", messages);
  } catch (error) {
    next(error);
  }
};

export const sendMessageHandler = async (req, res, next) => {
  try {
    const message = await chatService.createMessage({
      senderId: req.user.id,
      ...req.body,
    });
    return sendResponse(res, HTTP_STATUS.CREATED, "Message sent successfully", message);
  } catch (error) {
    next(error);
  }
};
