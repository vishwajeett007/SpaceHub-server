import { AppError } from "./AppError.js";
import { HTTP_STATUS } from "../constants/httpStatusCodes.js";

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}
