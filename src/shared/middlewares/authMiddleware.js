import { verifyToken } from "../utils/jwt.js";
import { AppError } from "../errors/AppError.js";
import { HTTP_STATUS } from "../constants/httpStatusCodes.js";
import { prisma } from "../../config/prisma.js";

export const protect = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new AppError("You are not logged in. Please log in to gain access.", HTTP_STATUS.UNAUTHORIZED);
    }

    const decoded = verifyToken(token);
    if (decoded.purpose && decoded.purpose !== "access") {
      throw new AppError("This token cannot be used to access protected resources.", HTTP_STATUS.UNAUTHORIZED);
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        firstName: true,
        lastName: true,
        isVerified: true,
      },
    });

    if (!currentUser) {
      throw new AppError("The user belonging to this token no longer exists.", HTTP_STATUS.UNAUTHORIZED);
    }
    if (!currentUser.isVerified) {
      throw new AppError("Please verify your email before accessing this resource.", HTTP_STATUS.UNAUTHORIZED);
    }

    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return next(new AppError("Invalid or expired token. Please log in again.", HTTP_STATUS.UNAUTHORIZED));
    }
    next(error);
  }
};
