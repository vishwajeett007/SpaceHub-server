import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import { notifyUser } from "../chat/nativeWebsocket.js";

export const searchUsers = async (query, currentUserId, limit = 10) => {
  if (!query || query.trim().length === 0) return [];

  const trimmed = query.trim();

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: currentUserId } },
        {
          OR: [
            { username: { contains: trimmed, mode: "insensitive" } },
            { email: { contains: trimmed, mode: "insensitive" } },
            { firstName: { contains: trimmed, mode: "insensitive" } },
            { lastName: { contains: trimmed, mode: "insensitive" } },
          ],
        },
      ],
    },
    take: limit,
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      bio: true,
      firstName: true,
      lastName: true,
    },
  });

  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { userId: currentUserId, friendId: { in: userIds } },
        { friendId: currentUserId, userId: { in: userIds } },
      ],
    },
  });

  const friendshipMap = new Map();
  friendships.forEach((f) => {
    if (f.status === "ACCEPTED") {
      const otherId = f.userId === currentUserId ? f.friendId : f.userId;
      friendshipMap.set(otherId, "FRIEND");
    } else if (f.status === "PENDING") {
      if (f.userId === currentUserId) {
        friendshipMap.set(f.friendId, "REQUEST_SENT");
      } else {
        friendshipMap.set(f.userId, "REQUEST_RECEIVED");
      }
    }
  });

  return users.map((u) => ({
    ...u,
    userId: u.id,
    friendshipStatus: friendshipMap.get(u.id) || "NONE",
  }));
};

export const cancelFriendRequest = async (currentUserId, friendIdentifier) => {
  let targetUser;
  if (friendIdentifier && String(friendIdentifier).includes('@')) {
    targetUser = await prisma.user.findUnique({ where: { email: friendIdentifier } });
  } else {
    targetUser = await prisma.user.findUnique({ where: { id: friendIdentifier } });
  }

  if (!targetUser) {
    throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
  }

  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: currentUserId, friendId: targetUser.id, status: "PENDING" },
        { userId: targetUser.id, friendId: currentUserId, status: "PENDING" },
      ],
    },
  });

  if (!friendship) {
    throw new AppError("No pending friend request found", HTTP_STATUS.NOT_FOUND);
  }

  await prisma.friendship.delete({
    where: { id: friendship.id },
  });

  return { success: true, message: "Friend request cancelled" };
};

export const getPendingFriendRequests = async (userId) => {
  const pendingFriendships = await prisma.friendship.findMany({
    where: {
      friendId: userId,
      status: "PENDING",
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return pendingFriendships.map((f) => {
    const sender = f.user;
    const displayName = [sender.firstName, sender.lastName].filter(Boolean).join(' ') || sender.username || (sender.email ? sender.email.split('@')[0] : 'User');
    return {
      id: f.id,
      senderId: sender.id,
      senderName: displayName,
      senderEmail: sender.email,
      senderProfileImageUrl: sender.avatarUrl,
      username: sender.username,
      firstName: sender.firstName,
      lastName: sender.lastName,
      referenceId: f.id,
      createdAt: f.createdAt,
    };
  });
};

export const sendFriendRequest = async (currentUserId, friendIdentifier) => {
  let targetUser;
  if (friendIdentifier && friendIdentifier.includes('@')) {
    targetUser = await prisma.user.findUnique({ where: { email: friendIdentifier } });
  } else {
    targetUser = await prisma.user.findUnique({ where: { id: friendIdentifier } });
  }

  if (!targetUser) {
    throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
  }

  if (targetUser.id === currentUserId) {
    throw new AppError("Cannot send friend request to yourself", HTTP_STATUS.BAD_REQUEST);
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: currentUserId, friendId: targetUser.id },
        { userId: targetUser.id, friendId: currentUserId },
      ],
    },
  });

  if (existing) {
    throw new AppError("Friend request or friendship already exists", HTTP_STATUS.CONFLICT);
  }

  const newFriendship = await prisma.friendship.create({
    data: {
      userId: currentUserId,
      friendId: targetUser.id,
      status: "PENDING",
    },
  });

  const sender = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  });

  if (sender && targetUser.email) {
    const displayName = [sender.firstName, sender.lastName].filter(Boolean).join(' ') || sender.username || sender.email.split('@')[0];
    const notificationData = {
      id: newFriendship.id,
      senderId: sender.id,
      senderName: displayName,
      senderEmail: sender.email,
      senderProfileImageUrl: sender.avatarUrl,
      username: sender.username,
      firstName: sender.firstName,
      lastName: sender.lastName,
      referenceId: newFriendship.id,
      createdAt: newFriendship.createdAt,
    };

    notifyUser(targetUser.email, "friend_request", notificationData);
  }

  return newFriendship;
};

export const getFriendsList = async (userId) => {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { userId, status: "ACCEPTED" },
        { friendId: userId, status: "ACCEPTED" },
      ],
    },
    include: {
      user: { select: { id: true, username: true, email: true, avatarUrl: true } },
      friend: { select: { id: true, username: true, email: true, avatarUrl: true } },
    },
  });

  return friendships.map((f) => (f.userId === userId ? f.friend : f.user));
};

export const respondToFriendRequest = async (currentUserId, requesterIdentifier, accept) => {
  let requester;
  if (requesterIdentifier && requesterIdentifier.includes('@')) {
    requester = await prisma.user.findUnique({ where: { email: requesterIdentifier } });
  } else {
    requester = await prisma.user.findUnique({ where: { id: requesterIdentifier } });
  }

  let friendship;
  if (requester) {
    friendship = await prisma.friendship.findFirst({
      where: {
        userId: requester.id,
        friendId: currentUserId,
      },
    });
  } else {

    friendship = await prisma.friendship.findUnique({
      where: { id: requesterIdentifier },
    });
  }

  if (!friendship) {
    throw new AppError("Friend request not found", HTTP_STATUS.NOT_FOUND);
  }

  if (accept) {
    return await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: "ACCEPTED" },
    });
  } else {
    return await prisma.friendship.delete({
      where: { id: friendship.id },
    });
  }
};

export const removeFriend = async (currentUserId, friendEmail) => {
  const friend = await prisma.user.findUnique({
    where: { email: friendEmail },
  });

  if (!friend) {
    throw new AppError("Friend not found", HTTP_STATUS.NOT_FOUND);
  }

  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: currentUserId, friendId: friend.id },
        { userId: friend.id, friendId: currentUserId },
      ],
    },
  });

  if (friendship) {
    await prisma.friendship.delete({ where: { id: friendship.id } });
  }

  return { success: true };
};
