import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

export const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      bio: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      memberships: {
        include: {
          community: {
            select: { id: true, name: true, slug: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
  }

  return user;
};

export const updateUserProfile = async (userId, updateData) => {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      bio: true,
      firstName: true,
      lastName: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};
