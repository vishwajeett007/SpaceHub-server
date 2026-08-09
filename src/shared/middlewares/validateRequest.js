import { AppError } from "../errors/AppError.js";
import { HTTP_STATUS } from "../constants/httpStatusCodes.js";

export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const dataToValidate = req.body || {};
      const result = schema.safeParse(dataToValidate);
      if (!result.success) {
        const issues = result.error?.issues || result.error?.errors || [];
        const firstErrorMessage = issues[0]?.message;
        const errorMessages = issues.map((err) => ({
          field: Array.isArray(err.path) ? err.path.join(".") : String(err.path),
          message: err.message,
        }));
        throw new AppError(
          firstErrorMessage || "Validation Error",
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          errorMessages
        );
      }
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};
