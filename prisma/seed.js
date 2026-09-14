import "dotenv/config";
import bcrypt from "bcrypt";

import { disconnectDB, prisma } from "../src/config/prisma.js";

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "DemoPass123!";
const DEMO_COMMUNITY_SLUG = "spacehub-demo-lounge";

const demoUsers = [
  {
    email: "ava.demo@spacehub.test",
    username: "demo_ava",
    firstName: "Ava",
    lastName: "Patel",
    bio: "Community owner and frontend developer.",
  },
  {
    email: "ben.demo@spacehub.test",
    username: "demo_ben",
    firstName: "Ben",
    lastName: "Kim",
    bio: "Backend developer who keeps the APIs moving.",
  },
  {
    email: "mia.demo@spacehub.test",
    username: "demo_mia",
    firstName: "Mia",
    lastName: "Rao",
    bio: "Product designer focused on friendly community experiences.",
  },
];

const demoCommunityCatalog = [
  ["Code & Coffee", "demo-code-coffee", "A relaxed place to share side projects, bugs, and good coffee."],
  ["Indie Game Forge", "demo-indie-game-forge", "Build, playtest, and celebrate independent games together."],
  ["Design Critique Club", "demo-design-critique", "Kind, practical feedback for product and visual designers."],
  ["AI Builders Lab", "demo-ai-builders-lab", "Experiments, prompts, agents, and useful AI products."],
  ["Book Nook", "demo-book-nook", "Monthly reads, thoughtful notes, and a quiet corner for book lovers."],
  ["Movie Night Society", "demo-movie-night-society", "Pick a film, press play, and discuss every scene afterward."],
  ["Travel Stories", "demo-travel-stories", "Itineraries, hidden gems, and photos from around the world."],
  ["Photography Walks", "demo-photography-walks", "Share your shots and plan the next neighborhood photo walk."],
  ["Music Makers", "demo-music-makers", "Songwriters, producers, and listeners exchanging works in progress."],
  ["Study Sprint", "demo-study-sprint", "Friendly accountability sessions for focused learning."],
  ["Startup Founders", "demo-startup-founders", "Validate ideas, compare notes, and help the next founder move faster."],
  ["Cooking Collective", "demo-cooking-collective", "Recipes, kitchen wins, and the occasional delicious experiment."],
  ["Language Exchange", "demo-language-exchange", "Practice a language with friendly learners from every level."],
  ["Open Source Guild", "demo-open-source-guild", "Find collaborators and contribute to projects that matter."],
  ["Garden Club", "demo-garden-club", "Growing tips, plant photos, and seasonal gardening plans."],
  ["Chess Corner", "demo-chess-corner", "Puzzles, friendly games, and post-match analysis."],
  ["Career Corner", "demo-career-corner", "Portfolios, interview practice, and supportive career advice."],
  ["Science & Space", "demo-science-space", "Curious minds talking about research, missions, and the cosmos."],
  ["Mindful Living", "demo-mindful-living", "Small habits, reflection prompts, and a calmer daily rhythm."],
  ["Pet People", "demo-pet-people", "Photos, stories, and practical care tips for beloved pets."],
  ["Maker Workshop", "demo-maker-workshop", "Hardware, crafts, prototypes, and hands-on creative projects."],
  ["Anime After Hours", "demo-anime-after-hours", "Recommendations, watch parties, and spoiler-marked conversations."],
  ["Fitness Circle", "demo-fitness-circle", "Share workouts, goals, and encouragement without the pressure."],
  ["Local Sports Hub", "demo-local-sports-hub", "Find a team, arrange a game, and cheer each other on."],
];

const demoBannerUrls = [
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=80",
];

const getDemoAvatarUrl = (seed) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=7c3aed,db2777,0891b2,059669,d97706&fontSize=40`;

const findOrCreateChannel = async ({ communityId, name, type }) => {
  const existingChannel = await prisma.channel.findFirst({
    where: { communityId, name, type },
  });

  if (existingChannel) return existingChannel;

  return prisma.channel.create({
    data: { communityId, name, type },
  });
};

const findOrCreateMessage = async (data) => {
  const existingMessage = await prisma.message.findFirst({
    where: {
      senderId: data.senderId,
      receiverId: data.receiverId ?? null,
      channelId: data.channelId ?? null,
      content: data.content,
    },
  });

  if (existingMessage) return existingMessage;

  return prisma.message.create({ data });
};

const seedPublicCommunity = async ({
  name,
  slug,
  description,
  avatarUrl,
  bannerUrl,
  owner,
  members,
}) => {
  const community = await prisma.community.upsert({
    where: { slug },
    update: {
      name,
      description,
      avatarUrl,
      bannerUrl,
      isPrivate: false,
      ownerId: owner.id,
    },
    create: {
      name,
      slug,
      description,
      avatarUrl,
      bannerUrl,
      isPrivate: false,
      ownerId: owner.id,
    },
  });

  await Promise.all(
    members.map((user) =>
      prisma.communityMember.upsert({
        where: { userId_communityId: { userId: user.id, communityId: community.id } },
        update: { role: user.id === owner.id ? "OWNER" : "MEMBER" },
        create: {
          userId: user.id,
          communityId: community.id,
          role: user.id === owner.id ? "OWNER" : "MEMBER",
        },
      })
    )
  );

  await Promise.all([
    findOrCreateChannel({ communityId: community.id, name: "general", type: "TEXT" }),
    findOrCreateChannel({ communityId: community.id, name: "introductions", type: "TEXT" }),
  ]);

  return community;
};

const main = async () => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed production. Set ALLOW_DEMO_SEED=true to run this intentionally.");
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const users = await Promise.all(
    demoUsers.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          passwordHash,
          isVerified: true,
        },
        create: {
          ...user,
          passwordHash,
          isVerified: true,
        },
      })
    )
  );

  const [ava, ben, mia] = users;

  const community = await prisma.community.upsert({
    where: { slug: DEMO_COMMUNITY_SLUG },
    update: {
      name: "SpaceHUB Demo Lounge",
      description: "A safe, seeded workspace for trying SpaceHUB features.",
      avatarUrl: getDemoAvatarUrl("SpaceHUB Demo Lounge"),
      bannerUrl: demoBannerUrls[0],
      isPrivate: false,
      ownerId: ava.id,
    },
    create: {
      name: "SpaceHUB Demo Lounge",
      slug: DEMO_COMMUNITY_SLUG,
      description: "A safe, seeded workspace for trying SpaceHUB features.",
      avatarUrl: getDemoAvatarUrl("SpaceHUB Demo Lounge"),
      bannerUrl: demoBannerUrls[0],
      isPrivate: false,
      ownerId: ava.id,
    },
  });

  await Promise.all([
    prisma.communityMember.upsert({
      where: { userId_communityId: { userId: ava.id, communityId: community.id } },
      update: { role: "OWNER" },
      create: { userId: ava.id, communityId: community.id, role: "OWNER" },
    }),
    prisma.communityMember.upsert({
      where: { userId_communityId: { userId: ben.id, communityId: community.id } },
      update: { role: "ADMIN" },
      create: { userId: ben.id, communityId: community.id, role: "ADMIN" },
    }),
    prisma.communityMember.upsert({
      where: { userId_communityId: { userId: mia.id, communityId: community.id } },
      update: { role: "MEMBER" },
      create: { userId: mia.id, communityId: community.id, role: "MEMBER" },
    }),
  ]);

  const [generalChannel, introductionsChannel] = await Promise.all([
    findOrCreateChannel({ communityId: community.id, name: "general", type: "TEXT" }),
    findOrCreateChannel({ communityId: community.id, name: "introductions", type: "TEXT" }),
    findOrCreateChannel({ communityId: community.id, name: "Lounge", type: "VOICE" }),
  ]);

  await prisma.communityRoom.upsert({
    where: { roomCode: "SPACEHUB-DEMO" },
    update: {
      communityId: community.id,
      name: "Demo Room",
      chatRooms: ["general", "introductions"],
      voiceRooms: ["Lounge"],
    },
    create: {
      communityId: community.id,
      name: "Demo Room",
      roomCode: "SPACEHUB-DEMO",
      chatRooms: ["general", "introductions"],
      voiceRooms: ["Lounge"],
    },
  });

  await Promise.all([
    findOrCreateMessage({
      senderId: ava.id,
      channelId: generalChannel.id,
      content: "Welcome to the SpaceHUB Demo Lounge! Start by introducing yourself.",
      text: "Welcome to the SpaceHUB Demo Lounge! Start by introducing yourself.",
      type: "TEXT",
    }),
    findOrCreateMessage({
      senderId: mia.id,
      channelId: introductionsChannel.id,
      content: "Hi, I am Mia. I am excited to explore the community features with you.",
      text: "Hi, I am Mia. I am excited to explore the community features with you.",
      type: "TEXT",
    }),
    findOrCreateMessage({
      senderId: ben.id,
      receiverId: ava.id,
      senderEmail: ben.email,
      receiverEmail: ava.email,
      content: "The demo data is ready. Want to test the real-time chat next?",
      text: "The demo data is ready. Want to test the real-time chat next?",
      type: "TEXT",
    }),
  ]);

  await Promise.all([
    prisma.friendship.upsert({
      where: { userId_friendId: { userId: ava.id, friendId: ben.id } },
      update: { status: "ACCEPTED" },
      create: { userId: ava.id, friendId: ben.id, status: "ACCEPTED" },
    }),
    prisma.friendship.upsert({
      where: { userId_friendId: { userId: mia.id, friendId: ava.id } },
      update: { status: "PENDING" },
      create: { userId: mia.id, friendId: ava.id, status: "PENDING" },
    }),
  ]);

  const catalogCommunities = [];
  for (const [index, [name, slug, description]] of demoCommunityCatalog.entries()) {
    catalogCommunities.push(
      await seedPublicCommunity({
        name,
        slug,
        description,
        avatarUrl: getDemoAvatarUrl(name),
        bannerUrl: demoBannerUrls[(index + 1) % demoBannerUrls.length],
        owner: ava,
        members: [ava, ben, mia],
      })
    );
  }

  console.log("Demo data seeded successfully.");
  console.log(`Community: ${community.name} (${community.slug})`);
  console.log(`Additional public communities: ${catalogCommunities.length}`);
  console.log("Demo accounts:");
  for (const user of demoUsers) {
    console.log(`- ${user.email} / ${DEMO_PASSWORD}`);
  }
};

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
