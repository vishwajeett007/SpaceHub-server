import { prisma } from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../shared/utils/passwordHasher.js";
import { signToken } from "../../shared/utils/jwt.js";
import { AppError } from "../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import { generateAndSendOtp, verifyOtpCode } from "../../shared/utils/emailService.js";

export const register = async ({ username, email, password, firstName, lastName }) => {
  const effectiveUsername =
    username || `${email.split("@")[0]}_${Math.floor(1000 + Math.random() * 9000)}`;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username: effectiveUsername }],
    },
  });

  if (existingUser) {
    if (existingUser.isVerified) {
      throw new AppError("Email is already registered. Please log in.", HTTP_STATUS.CONFLICT, [
        { field: "email", message: "Email is already registered. Please log in." }
      ]);
    }

    const passwordHash = await hashPassword(password);
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        firstName: firstName || existingUser.firstName,
        lastName: lastName || existingUser.lastName,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        createdAt: true,
      },
    });

    await generateAndSendOtp(email);
    const token = signToken({ userId: updatedUser.id, email: updatedUser.email });
    return { user: updatedUser, token, pendingVerification: true };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      username: effectiveUsername,
      email,
      passwordHash,
      firstName,
      lastName,
      isVerified: false,
    },
    select: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      firstName: true,
      lastName: true,
      isVerified: true,
      createdAt: true,
    },
  });

  await generateAndSendOtp(email);
  const token = signToken({ userId: newUser.id, email: newUser.email });

  return { user: newUser, token, pendingVerification: true };
};

export const login = async ({ email, identifier, password }) => {
  const targetEmail = email || identifier;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: targetEmail }, { username: targetEmail }],
    },
  });

  if (!user) {
    throw new AppError("Invalid credentials", HTTP_STATUS.UNAUTHORIZED);
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", HTTP_STATUS.UNAUTHORIZED);
  }

  const token = signToken({ userId: user.id, email: user.email });
  const { passwordHash: _, ...userWithoutPassword } = user;

  if (!user.isVerified) {
    await generateAndSendOtp(user.email);
    return {
      user: userWithoutPassword,
      token,
      pendingVerification: true,
      message: "Please verify your OTP to complete activation."
    };
  }

  return { user: userWithoutPassword, token, pendingVerification: false };
};

export const verifyRegisterOtp = async ({ identifier, email, otp }) => {
  const targetEmail = identifier || email;
  if (!targetEmail) {
    throw new AppError("Email or identifier is required for OTP verification.", HTTP_STATUS.BAD_REQUEST);
  }

  if (otp) {
    const isValid = verifyOtpCode(targetEmail, otp);
    if (!isValid) {
      throw new AppError("Invalid or expired OTP. Please try again.", HTTP_STATUS.BAD_REQUEST);
    }
  }

  const updatedUser = await prisma.user.updateMany({
    where: { email: targetEmail },
    data: { isVerified: true },
  });

  return updatedUser;
};

export const resendOtp = async (email) => {
  if (!email) {
    throw new AppError("Email is required to resend OTP.", HTTP_STATUS.BAD_REQUEST);
  }
  return await generateAndSendOtp(email);
};
