import { NotFoundError } from "../errors/NotFoundError.js";

export const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};
