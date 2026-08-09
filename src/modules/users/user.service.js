import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";

import { hashPassword, comparePassword } from "../../shared/utils/passwordHasher.js";

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
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!currentUser) {
    throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
  }

  const { currentPassword, newPassword, email, ...rest } = updateData;
  const dataToUpdate = { ...rest };

  if (currentPassword || newPassword) {
    if (!currentPassword || !newPassword) {
      throw new AppError("Both current password and new password are required", HTTP_STATUS.BAD_REQUEST);
    }
    const isPasswordValid = await comparePassword(currentPassword, currentUser.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Current password is incorrect", HTTP_STATUS.UNAUTHORIZED);
    }
    dataToUpdate.passwordHash = await hashPassword(newPassword);
  }

  delete dataToUpdate.currentPassword;
  delete dataToUpdate.newPassword;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
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

export const deleteUserAccount = async (userId, currentPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
  }

  const isPasswordValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError("Incorrect password", HTTP_STATUS.UNAUTHORIZED);
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  return { success: true };
};
