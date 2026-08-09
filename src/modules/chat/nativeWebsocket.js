import { WebSocketServer, WebSocket } from "ws";
import { parse } from "node:url";
import { prisma } from "../../config/prisma.js";
import { getPendingCommunityRequests } from "../communities/community.service.js";

// Store active native WebSocket client connections
const directChatConnections = new Map();
const notificationConnections = new Map();

export const notifyUser = (email, eventType, data) => {
  if (!email) return;
  const key = String(email).trim().toLowerCase();
  if (notificationConnections.has(key)) {
    const ws = notificationConnections.get(key);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: eventType, data }));
    }
  }
};

const sendPendingFriendRequests = async (email, ws) => {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const pendingFriendships = await prisma.friendship.findMany({
      where: {
        friendId: user.id,
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

    const formattedRequests = pendingFriendships.map((f) => {
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

    const pendingCommunityRequests = await getPendingCommunityRequests(user.id);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "friend_requests_bulk",
        data: formattedRequests,
      }));
      ws.send(JSON.stringify({
        type: "community_requests_bulk",
        data: pendingCommunityRequests,
      }));
    }
  } catch (error) {
    console.error("Error sending pending friend requests over WS:", error);
  }
};

export const initializeNativeWebSockets = (httpServer) => {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const { pathname, query } = parse(request.url, true);

    if (pathname.includes("/socket.io")) {
      // Let Socket.IO handle engine.io upgrades
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.pathname = pathname;
      ws.query = query;
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    const { pathname, query } = ws;

    if (pathname && (pathname.includes("/direct-chat") || pathname.includes("/chat"))) {
      const rawUserKey = query.senderEmail || query.sender || query.userEmail || query.email || "anonymous";
      const userKey = String(rawUserKey).trim().toLowerCase();
      directChatConnections.set(userKey, ws);

      console.log(`🔌 Native Direct Chat WS connected: ${userKey}`);

      ws.on("message", (rawMessage) => {
        try {
          const parsed = JSON.parse(rawMessage.toString());
          const rawReceiverKey = parsed.receiverEmail || parsed.friendEmail || parsed.receiver || parsed.to;
          const receiverKey = rawReceiverKey ? String(rawReceiverKey).trim().toLowerCase() : null;

          const messagePayload = {
            ...parsed,
            type: parsed.type || "message",
            timestamp: parsed.timestamp || new Date().toISOString(),
          };

          // Echo back to sender
          ws.send(JSON.stringify(messagePayload));

          // Forward to receiver if connected
          if (receiverKey && directChatConnections.has(receiverKey)) {
            const receiverSocket = directChatConnections.get(receiverKey);
            if (receiverSocket.readyState === WebSocket.OPEN) {
              receiverSocket.send(JSON.stringify(messagePayload));
            }
          }
        } catch (error) {
          console.error("Native WS parsing error:", error);
        }
      });

      ws.on("close", () => {
        directChatConnections.delete(userKey);
        console.log(`🔌 Native Direct Chat WS disconnected: ${userKey}`);
      });
    } else if (pathname && pathname.includes("/notification")) {
      const rawEmail = query.email || "anonymous";
      const email = String(rawEmail).trim().toLowerCase();
      notificationConnections.set(email, ws);

      console.log(`🔔 Notification WS connected: ${email}`);

      // Send current pending friend requests immediately on connect
      sendPendingFriendRequests(email, ws);

      ws.on("message", (rawMsg) => {
        try {
          const parsed = JSON.parse(rawMsg.toString());
          if (
            parsed.type === "request_notifications" ||
            parsed.event === "request_notifications" ||
            parsed.type === "get_notifications"
          ) {
            sendPendingFriendRequests(email, ws);
          }
        } catch (err) {
          console.error("Notification WS message parse error:", err);
        }
      });

      ws.on("close", () => {
        notificationConnections.delete(email);
        console.log(`🔔 Notification WS disconnected: ${email}`);
      });
    } else {
      // Generic WebRTC / STOMP fallback
      ws.on("message", (message) => {
        // Broadcast signaling to all clients except sender
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message.toString());
          }
        });
      });
    }
  });
};
