import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../shared/utils/passwordHasher.js";
import { signToken, verifyToken } from "../../shared/utils/jwt.js";
import { AppError } from "../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import { generateAndSendOtp, verifyOtpCode } from "../../shared/utils/emailService.js";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const getPasswordResetMarker = (passwordHash) => (
  createHash("sha256").update(String(passwordHash || "")).digest("hex")
);

const createDefaultUsername = (email) => {
  const emailPrefix = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32) || "user";
  return `${emailPrefix}_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
};

const createRegistrationToken = (user) => signToken({
  userId: user.id,
  email: user.email,
  purpose: "registration",
}, { expiresIn: "15m" });

const verifyPurposeSession = (sessionToken, purpose, label) => {
  if (!sessionToken) {
    throw new AppError(`${label} session has expired. Please start again.`, HTTP_STATUS.UNAUTHORIZED);
  }

  let decoded;
  try {
    decoded = verifyToken(sessionToken);
  } catch {
    throw new AppError(`${label} session is invalid or expired. Please start again.`, HTTP_STATUS.UNAUTHORIZED);
  }

  if (decoded.purpose !== purpose || !decoded.userId || !decoded.email) {
    throw new AppError(`Invalid ${label.toLowerCase()} session.`, HTTP_STATUS.UNAUTHORIZED);
  }

  return decoded;
};

const verifyRegistrationSession = (sessionToken, requestedEmail) => {
  const decoded = verifyPurposeSession(sessionToken, "registration", "Registration");

  const normalizedRequestedEmail = normalizeEmail(requestedEmail);
  if (normalizedRequestedEmail && normalizeEmail(decoded.email) !== normalizedRequestedEmail) {
    throw new AppError("Registration session does not match this email.", HTTP_STATUS.UNAUTHORIZED);
  }

  return decoded;
};

export const register = async ({ username, email, password, firstName, lastName }) => {
  const normalizedEmail = normalizeEmail(email);
  const requestedUsername = username?.trim();

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
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

    await generateAndSendOtp(updatedUser.email);
    const token = createRegistrationToken(updatedUser);
    return { user: updatedUser, token, pendingVerification: true };
  }

  if (requestedUsername) {
    const usernameOwner = await prisma.user.findFirst({
      where: { username: { equals: requestedUsername, mode: "insensitive" } },
      select: { id: true },
    });
    if (usernameOwner) {
      throw new AppError("Username is already in use.", HTTP_STATUS.CONFLICT, [
        { field: "username", message: "Username is already in use." },
      ]);
    }
  }

  const passwordHash = await hashPassword(password);
  const effectiveUsername = requestedUsername || createDefaultUsername(normalizedEmail);

  const newUser = await prisma.user.create({
    data: {
      username: effectiveUsername,
      email: normalizedEmail,
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

  await generateAndSendOtp(newUser.email);
  const token = createRegistrationToken(newUser);

  return { user: newUser, token, pendingVerification: true };
};

export const login = async ({ email, identifier, password }) => {
  const targetIdentifier = String(email || identifier || "").trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: targetIdentifier, mode: "insensitive" } },
        { username: { equals: targetIdentifier, mode: "insensitive" } },
      ],
    },
  });

  if (!user) {
    throw new AppError("Invalid credentials", HTTP_STATUS.UNAUTHORIZED);
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", HTTP_STATUS.UNAUTHORIZED);
  }

  const { passwordHash: _, ...userWithoutPassword } = user;

  if (!user.isVerified) {
    await generateAndSendOtp(user.email);
    return {
      user: userWithoutPassword,
      token: createRegistrationToken(user),
      pendingVerification: true,
      message: "Please verify your OTP to complete activation."
    };
  }

  const token = signToken({ userId: user.id, email: user.email, purpose: "access" });
  return { user: userWithoutPassword, token, pendingVerification: false };
};

export const verifyRegisterOtp = async ({ identifier, email, otp, sessionToken }) => {
  const targetEmail = identifier || email;
  if (!targetEmail) {
    throw new AppError("Email or identifier is required for OTP verification.", HTTP_STATUS.BAD_REQUEST);
  }

  if (!/^\d{6}$/.test(String(otp || ""))) {
    throw new AppError("A valid 6-digit OTP is required.", HTTP_STATUS.BAD_REQUEST);
  }

  const registrationSession = verifyRegistrationSession(sessionToken, targetEmail);
  const user = await prisma.user.findUnique({
    where: { id: registrationSession.userId },
    select: { id: true, email: true, isVerified: true },
  });

  if (!user || normalizeEmail(user.email) !== normalizeEmail(registrationSession.email)) {
    throw new AppError("Registration session is no longer valid.", HTTP_STATUS.UNAUTHORIZED);
  }
  if (user.isVerified) {
    throw new AppError("This account is already verified. Please log in.", HTTP_STATUS.CONFLICT);
  }

  const isValid = verifyOtpCode(user.email, String(otp));
  if (!isValid) {
    throw new AppError("Invalid or expired OTP. Please try again.", HTTP_STATUS.BAD_REQUEST);
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true },
    select: { id: true, email: true, username: true, isVerified: true },
  });

  return updatedUser;
};

export const resendOtp = async (email, sessionToken) => {
  if (!email) {
    throw new AppError("Email is required to resend OTP.", HTTP_STATUS.BAD_REQUEST);
  }

  const registrationSession = verifyRegistrationSession(sessionToken, email);
  const user = await prisma.user.findUnique({
    where: { id: registrationSession.userId },
    select: { email: true, isVerified: true },
  });

  if (!user || normalizeEmail(user.email) !== normalizeEmail(registrationSession.email)) {
    throw new AppError("Registration session is no longer valid.", HTTP_STATUS.UNAUTHORIZED);
  }
  if (user.isVerified) {
    throw new AppError("This account is already verified. Please log in.", HTTP_STATUS.CONFLICT);
  }

  return generateAndSendOtp(user.email);
};

export const requestPasswordReset = async (identifier) => {
  const targetIdentifier = String(identifier || "").trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: targetIdentifier, mode: "insensitive" } },
        { username: { equals: targetIdentifier, mode: "insensitive" } },
      ],
    },
    select: { id: true, email: true, isVerified: true },
  });

  if (!user || !user.isVerified) {
    throw new AppError("No verified account was found for this email.", HTTP_STATUS.NOT_FOUND);
  }

  await generateAndSendOtp(user.email);
  const tempToken = signToken({
    userId: user.id,
    email: user.email,
    purpose: "forgot-password",
  }, { expiresIn: "10m" });

  return { email: user.email, tempToken };
};

export const verifyForgotPasswordOtp = async ({ identifier, email, otp, tempToken }) => {
  const targetEmail = identifier || email;
  const resetSession = verifyPurposeSession(tempToken, "forgot-password", "Password reset");

  if (targetEmail && normalizeEmail(targetEmail) !== normalizeEmail(resetSession.email)) {
    throw new AppError("Password reset session does not match this email.", HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({
    where: { id: resetSession.userId },
    select: { id: true, email: true, isVerified: true, passwordHash: true },
  });
  if (!user || !user.isVerified || normalizeEmail(user.email) !== normalizeEmail(resetSession.email)) {
    throw new AppError("Password reset session is no longer valid.", HTTP_STATUS.UNAUTHORIZED);
  }

  if (!verifyOtpCode(user.email, String(otp || ""))) {
    throw new AppError("Invalid or expired OTP. Please try again.", HTTP_STATUS.BAD_REQUEST);
  }

  const accessToken = signToken({
    userId: user.id,
    email: user.email,
    purpose: "password-reset",
    resetMarker: getPasswordResetMarker(user.passwordHash),
  }, { expiresIn: "15m" });

  return { accessToken };
};

export const resendForgotPasswordOtp = async (tempToken) => {
  const resetSession = verifyPurposeSession(tempToken, "forgot-password", "Password reset");
  const user = await prisma.user.findUnique({
    where: { id: resetSession.userId },
    select: { email: true, isVerified: true },
  });

  if (!user || !user.isVerified || normalizeEmail(user.email) !== normalizeEmail(resetSession.email)) {
    throw new AppError("Password reset session is no longer valid.", HTTP_STATUS.UNAUTHORIZED);
  }

  await generateAndSendOtp(user.email);
  return { email: user.email };
};

export const resetPassword = async ({ identifier, email, newPassword, tempToken, token }) => {
  const targetEmail = identifier || email;
  const resetSession = verifyPurposeSession(
    tempToken || token,
    "password-reset",
    "Password reset",
  );

  if (targetEmail && normalizeEmail(targetEmail) !== normalizeEmail(resetSession.email)) {
    throw new AppError("Password reset session does not match this email.", HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({
    where: { id: resetSession.userId },
    select: { id: true, email: true, isVerified: true, passwordHash: true },
  });
  if (!user || !user.isVerified || normalizeEmail(user.email) !== normalizeEmail(resetSession.email)) {
    throw new AppError("Password reset session is no longer valid.", HTTP_STATUS.UNAUTHORIZED);
  }
  if (resetSession.resetMarker !== getPasswordResetMarker(user.passwordHash)) {
    throw new AppError("Password reset token has already been used or is no longer valid.", HTTP_STATUS.UNAUTHORIZED);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return { email: user.email };
};
