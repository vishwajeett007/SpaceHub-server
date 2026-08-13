import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export const signToken = (payload, { expiresIn = env.JWT_EXPIRES_IN } = {}) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn,
    algorithm: "HS256",
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
};
