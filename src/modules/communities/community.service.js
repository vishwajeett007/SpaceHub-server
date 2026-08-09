import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../shared/constants/httpStatusCodes.js";
import { ROLES } from "../../shared/constants/roles.js";
import { notifyUser } from "../chat/nativeWebsocket.js";

const generateSlug = (name) => {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") +
    "-" +
    Math.floor(1000 + Math.random() * 9000)
  );
};

export const createCommunity = async (ownerId, { name, description, avatarUrl, isPrivate }) => {
  const slug = generateSlug(name);

  const community = await prisma.community.create({
    data: {
      name,
      slug,
      description,
      avatarUrl,
      isPrivate,
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: ROLES.OWNER,
        },
      },
      channels: {
        create: [
          { name: "general", type: "TEXT" },
        ],
      },
    },
    include: {
      members: true,
      channels: true,
    },
  });

  return community;
};

export const getUserJoinedCommunities = async (userId, isPrivateFilter = null) => {
  const whereCondition = {
    OR: [
      { ownerId: userId },
      { members: { some: { userId, role: { not: ROLES.PENDING } } } }
    ]
  };

  if (isPrivateFilter !== null) {
    whereCondition.isPrivate = isPrivateFilter;
  }

  const communities = await prisma.community.findMany({
    where: whereCondition,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      avatarUrl: true,
      bannerUrl: true,
      isPrivate: true,
      ownerId: true,
      createdAt: true,
      _count: {
        select: {
          members: {
            where: { role: { not: ROLES.PENDING } }
          }
        },
      },
    },
  });

  return communities.map((c) => ({
    ...c,
    memberCount: c._count?.members ?? 0,
  }));
};

export const getAllPublicCommunities = async (userId = null) => {
  const communities = await prisma.community.findMany({
    where: { isPrivate: false },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      avatarUrl: true,
      ownerId: true,
      createdAt: true,
      members: userId ? {
        where: { userId },
        select: { id: true, role: true }
      } : false,
      _count: {
        select: {
          members: {
            where: { role: { not: ROLES.PENDING } }
          }
        },
      },
    },
  });

  return communities.map((c) => {
    const userMembership = userId && c.members ? c.members.find(m => m) : null;
    const isMember = c.ownerId === userId || (userMembership && userMembership.role !== ROLES.PENDING);
    const isPending = userMembership && userMembership.role === ROLES.PENDING;
    const memberCount = c._count?.members ?? 0;
    const { members, ...rest } = c;
    return {
      ...rest,
      memberCount,
      isMember,
      isPending,
    };
  });
};

export const getCommunityBySlug = async (slug) => {
  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      channels: true,
      members: {
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!community) {
    throw new AppError("Community not found", HTTP_STATUS.NOT_FOUND);
  }

  return community;
};

export const getCommunityMembers = async (identifier) => {
  if (!identifier) return [];

  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: identifier },
        { slug: identifier },
        { name: identifier }
      ]
    },
    select: { id: true, ownerId: true }
  });

  if (!community) {
    return [];
  }

  const members = await prisma.communityMember.findMany({
    where: {
      communityId: community.id,
      role: { not: ROLES.PENDING }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true
        }
      }
    }
  });

  const memberList = members.map(m => ({
    id: m.id,
    memberId: m.id,
    userId: m.userId,
    username: m.user?.username,
    email: m.user?.email,
    name: [m.user?.firstName, m.user?.lastName].filter(Boolean).join(' ') || m.user?.username || m.user?.email,
    avatarUrl: m.user?.avatarUrl,
    avatarPreviewUrl: m.user?.avatarUrl,
    role: m.userId === community.ownerId ? ROLES.OWNER : m.role,
    createdAt: m.createdAt
  }));

  const hasOwner = memberList.some(m => m.userId === community.ownerId);
  if (!hasOwner && community.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: community.ownerId },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, avatarUrl: true }
    });
    if (owner) {
      memberList.unshift({
        id: `owner-${owner.id}`,
        memberId: `owner-${owner.id}`,
        userId: owner.id,
        username: owner.username,
        email: owner.email,
        name: [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.username || owner.email,
        avatarUrl: owner.avatarUrl,
        avatarPreviewUrl: owner.avatarUrl,
        role: ROLES.OWNER,
        createdAt: new Date()
      });
    }
  }

  return memberList;
};

const notifyAdminsOfJoinRequest = async (requesterId, community, referenceId) => {
  try {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, avatarUrl: true },
    });

    if (!requester) return;

    const ownerUser = await prisma.user.findUnique({ where: { id: community.ownerId } });
    const adminMembers = await prisma.communityMember.findMany({
      where: {
        communityId: community.id,
        role: { in: [ROLES.ADMIN, ROLES.OWNER] },
      },
      include: { user: true },
    });

    const adminEmails = new Set();
    if (ownerUser?.email) adminEmails.add(ownerUser.email);
    adminMembers.forEach((m) => {
      if (m.user?.email) adminEmails.add(m.user.email);
    });

    const displayName = [requester.firstName, requester.lastName].filter(Boolean).join(' ') || requester.username || (requester.email ? requester.email.split('@')[0] : 'User');

    const notificationPayload = {
      id: referenceId,
      referenceId,
      communityId: community.id,
      communityName: community.name,
      senderId: requester.id,
      senderName: displayName,
      senderEmail: requester.email,
      senderProfileImageUrl: requester.avatarUrl,
      username: requester.username,
      firstName: requester.firstName,
      lastName: requester.lastName,
      createdAt: new Date().toISOString(),
    };

    adminEmails.forEach((email) => {
      notifyUser(email, "community_request", notificationPayload);
    });
  } catch (err) {
    console.error("Failed to notify admins of community join request:", err);
  }
};

export const joinCommunity = async (userId, identifier) => {
  if (!identifier) {
    throw new AppError("Community identifier is required", HTTP_STATUS.BAD_REQUEST);
  }

  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: identifier },
        { slug: identifier.toLowerCase() },
        { name: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });

  if (!community) {
    throw new AppError("Community not found", HTTP_STATUS.NOT_FOUND);
  }

  const existingMember = await prisma.communityMember.findUnique({
    where: {
      userId_communityId: { userId, communityId: community.id },
    },
  });

  if (existingMember) {
    if (existingMember.role === ROLES.PENDING) {
      return {
        alreadyMember: false,
        alreadyRequested: true,
        message: "Your join request is pending admin approval",
        community,
        membership: existingMember,
      };
    }

    return {
      alreadyMember: true,
      alreadyRequested: false,
      message: "You are already a member of this community",
      community,
      membership: existingMember,
    };
  }

  // Create pending membership request
  const membership = await prisma.communityMember.create({
    data: {
      userId,
      communityId: community.id,
      role: ROLES.PENDING,
    },
  });

  // Real-time notification to owner and admins
  await notifyAdminsOfJoinRequest(userId, community, membership.id);

  return {
    alreadyMember: false,
    alreadyRequested: true,
    message: "Join request sent to community admins",
    community,
    membership,
  };
};

export const leaveCommunity = async (userId, identifier) => {
  if (!identifier) {
    throw new AppError("Community identifier is required", HTTP_STATUS.BAD_REQUEST);
  }

  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: identifier },
        { slug: identifier.toLowerCase() },
        { name: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });

  if (!community) {
    throw new AppError("Community not found", HTTP_STATUS.NOT_FOUND);
  }

  const member = await prisma.communityMember.findUnique({
    where: {
      userId_communityId: { userId, communityId: community.id },
    },
  });

  if (member) {
    await prisma.communityMember.delete({
      where: { id: member.id },
    });
  }

  return { success: true, message: "Left community / cancelled join request" };
};

export const getPendingCommunityRequests = async (userId) => {
  const ownedCommunities = await prisma.community.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
  });

  const adminMemberships = await prisma.communityMember.findMany({
    where: {
      userId,
      role: { in: [ROLES.ADMIN, ROLES.OWNER] },
    },
    select: { community: { select: { id: true, name: true } } },
  });

  const communityMap = new Map();
  ownedCommunities.forEach((c) => communityMap.set(c.id, c.name));
  adminMemberships.forEach((m) => {
    if (m.community) communityMap.set(m.community.id, m.community.name);
  });

  const communityIds = Array.from(communityMap.keys());
  if (communityIds.length === 0) return [];

  const pendingMembers = await prisma.communityMember.findMany({
    where: {
      communityId: { in: communityIds },
      role: ROLES.PENDING,
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
      community: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return pendingMembers.map((req) => {
    const requester = req.user;
    const displayName = [requester.firstName, requester.lastName].filter(Boolean).join(' ') || requester.username || (requester.email ? requester.email.split('@')[0] : 'User');
    return {
      id: req.id,
      referenceId: req.id,
      communityId: req.community.id,
      communityName: req.community.name,
      senderId: requester.id,
      senderName: displayName,
      senderEmail: requester.email,
      senderProfileImageUrl: requester.avatarUrl,
      username: requester.username,
      firstName: requester.firstName,
      lastName: requester.lastName,
      createdAt: req.createdAt,
    };
  });
};

export const acceptCommunityJoinRequest = async (adminUserId, payload) => {
  let memberRecord;
  if (payload.referenceId || payload.id) {
    memberRecord = await prisma.communityMember.findUnique({
      where: { id: payload.referenceId || payload.id },
    });
  }

  if (!memberRecord) {
    const targetUser = await prisma.user.findUnique({
      where: { email: payload.userEmail || payload.requesterEmail },
    });

    if (targetUser) {
      const community = await prisma.community.findFirst({
        where: {
          OR: [
            { id: payload.communityId },
            { name: { equals: payload.communityName, mode: "insensitive" } },
          ],
        },
      });

      if (community) {
        memberRecord = await prisma.communityMember.findUnique({
          where: {
            userId_communityId: { userId: targetUser.id, communityId: community.id },
          },
        });
      }
    }
  }

  if (!memberRecord) {
    throw new AppError("Join request not found", HTTP_STATUS.NOT_FOUND);
  }

  return await prisma.communityMember.update({
    where: { id: memberRecord.id },
    data: { role: ROLES.MEMBER },
  });
};

export const rejectCommunityJoinRequest = async (adminUserId, payload) => {
  let memberRecord;
  if (payload.referenceId || payload.id) {
    memberRecord = await prisma.communityMember.findUnique({
      where: { id: payload.referenceId || payload.id },
    });
  }

  if (!memberRecord) {
    const targetUser = await prisma.user.findUnique({
      where: { email: payload.userEmail || payload.requesterEmail },
    });

    if (targetUser) {
      const community = await prisma.community.findFirst({
        where: {
          OR: [
            { id: payload.communityId },
            { name: { equals: payload.communityName, mode: "insensitive" } },
          ],
        },
      });

      if (community) {
        memberRecord = await prisma.communityMember.findUnique({
          where: {
            userId_communityId: { userId: targetUser.id, communityId: community.id },
          },
        });
      }
    }
  }

  if (!memberRecord) {
    throw new AppError("Join request not found", HTTP_STATUS.NOT_FOUND);
  }

  return await prisma.communityMember.delete({
    where: { id: memberRecord.id },
  });
};

export const updateMemberRole = async (communityId, targetUserEmail, newRole) => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: targetUserEmail },
        { username: targetUserEmail },
        { id: targetUserEmail },
      ],
    },
  });
  if (!user) {
    throw new AppError("Target user not found", HTTP_STATUS.NOT_FOUND);
  }

  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: communityId },
        { slug: communityId },
        { name: communityId },
      ],
    },
  });

  if (!community) {
    throw new AppError("Community not found", HTTP_STATUS.NOT_FOUND);
  }

  let validRole = String(newRole).toUpperCase();
  if (validRole === 'WORKSPACE_OWNER' || validRole === 'OWNER') {
    validRole = ROLES.ADMIN;
  } else if (validRole !== ROLES.ADMIN && validRole !== ROLES.MEMBER) {
    validRole = ROLES.MEMBER;
  }

  if (community.ownerId === user.id) {
    throw new AppError("Cannot modify community owner role", HTTP_STATUS.BAD_REQUEST);
  }

  const existingMember = await prisma.communityMember.findUnique({
    where: {
      userId_communityId: { userId: user.id, communityId: community.id },
    },
  });

  if (existingMember) {
    return await prisma.communityMember.update({
      where: { id: existingMember.id },
      data: { role: validRole },
    });
  } else {
    return await prisma.communityMember.create({
      data: {
        userId: user.id,
        communityId: community.id,
        role: validRole,
      },
    });
  }
};

export const updateCommunityProfile = async (communityId, { name, description, avatarUrl, bannerUrl }) => {
  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: communityId },
        { slug: communityId },
        { name: communityId },
      ],
    },
  });

  if (!community) {
    throw new AppError("Community not found", HTTP_STATUS.NOT_FOUND);
  }

  const dataToUpdate = {};
  if (name) dataToUpdate.name = name;
  if (description !== undefined) dataToUpdate.description = description;
  if (avatarUrl) dataToUpdate.avatarUrl = avatarUrl;

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: dataToUpdate,
  });

  return updated;
};

export const removeMemberFromCommunity = async (communityId, targetUserEmail) => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: targetUserEmail },
        { username: targetUserEmail },
        { id: targetUserEmail },
      ],
    },
  });
  if (!user) {
    throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
  }
  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: communityId },
        { slug: communityId },
        { name: communityId },
      ],
    },
  });
  if (!community) {
    throw new AppError("Community not found", HTTP_STATUS.NOT_FOUND);
  }
  await prisma.communityMember.deleteMany({
    where: {
      userId: user.id,
      communityId: community.id,
    },
  });
  return { success: true };
};

export const deleteCommunityByNameOrId = async (identifier) => {
  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: identifier },
        { slug: identifier },
        { name: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });
  if (!community) {
    throw new AppError("Community not found", HTTP_STATUS.NOT_FOUND);
  }
  await prisma.community.delete({
    where: { id: community.id },
  });
  return { success: true };
};
