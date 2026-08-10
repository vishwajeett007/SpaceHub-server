import { WebSocketServer, WebSocket } from "ws";
import { parse } from "node:url";
import { prisma } from "../../config/prisma.js";
import { getPendingCommunityRequests } from "../communities/community.service.js";
import { getRoomMessagesFromStorage, saveRoomMessageToStorage } from "../communities/communityMessageStorage.js";
import { getDirectMessagesFromStorage, saveDirectMessageToStorage } from "../social/directMessageStorage.js";

const directChatConnections = new Map();
const notificationConnections = new Map();
const roomConnectionsMap = new Map();

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

  wss.on("error", (error) => {
    console.error("WebSocketServer error:", error);
  });

  httpServer.on("upgrade", (request, socket, head) => {
    try {
      const { pathname, query } = parse(request.url, true);

      if (pathname && pathname.includes("/socket.io")) {

        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.pathname = pathname;
        ws.query = query;
        wss.emit("connection", ws, request);
      });
    } catch (err) {
      console.error("Native WS upgrade error:", err);
      if (!socket.destroyed) {
        socket.destroy();
      }
    }
  });

  wss.on("connection", (ws, request) => {
    ws.on("error", (err) => {
      console.error("Native WS connection error:", err);
    });

    const { pathname, query } = ws;

    if (pathname && (pathname.includes("/direct-chat") || pathname.includes("/chat") || pathname.includes("/ws"))) {
      const rawUserKey = query.senderEmail || query.sender || query.userEmail || query.email || "anonymous";
      const userKey = String(rawUserKey).trim().toLowerCase();
      const rawReceiverKey = query.receiverEmail || query.friendEmail || query.receiver || query.to;
      const receiverEmailKey = rawReceiverKey ? String(rawReceiverKey).trim().toLowerCase() : null;
      const roomCode = query.roomCode || query.room;

      directChatConnections.set(userKey, ws);

      if (roomCode) {
        if (!roomConnectionsMap.has(roomCode)) {
          roomConnectionsMap.set(roomCode, new Set());
        }
        roomConnectionsMap.get(roomCode).add(ws);

        console.log(`🔌 Client ${userKey} joined room WS: ${roomCode}`);

        getRoomMessagesFromStorage(roomCode).then((history) => {
          if (history && history.length > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "history",
              roomCode: roomCode,
              messages: history,
            }));
          }
        }).catch(console.error);
      } else if (receiverEmailKey) {

        getDirectMessagesFromStorage(userKey, receiverEmailKey).then((history) => {
          if (history && history.length > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "history",
              senderEmail: userKey,
              receiverEmail: receiverEmailKey,
              messages: history,
            }));
          }
        }).catch(console.error);
      }

      ws.on("message", async (rawMessage) => {
        try {
          const parsed = JSON.parse(rawMessage.toString());
          const targetRoomCode = parsed.roomCode || roomCode;
          const senderEmail = parsed.senderEmail || parsed.email || userKey;
          const rawReceiverKey = parsed.receiverEmail || parsed.friendEmail || parsed.receiver || parsed.to || receiverEmailKey;
          const receiverKey = rawReceiverKey ? String(rawReceiverKey).trim().toLowerCase() : null;
          const senderName = parsed.senderName || parsed.author || (senderEmail ? senderEmail.split('@')[0] : 'User');
          const messageText = parsed.message || parsed.text || parsed.content || "";

          const isFileMsg = String(parsed.type || '').toUpperCase() === 'FILE' || Boolean(parsed.fileKey || parsed.file_key || parsed.fileUrl || parsed.file_url);

          const messagePayload = {
            id: parsed.id || `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            ...parsed,
            roomCode: targetRoomCode,
            senderEmail: String(senderEmail).trim().toLowerCase(),
            email: String(senderEmail).trim().toLowerCase(),
            receiverEmail: receiverKey,
            senderName: senderName,
            author: senderName,
            message: messageText,
            text: messageText,
            content: messageText,
            type: isFileMsg ? 'FILE' : (parsed.type || "message"),
            timestamp: parsed.timestamp || parsed.createdAt || new Date().toISOString(),
            createdAt: parsed.timestamp || parsed.createdAt || new Date().toISOString(),
          };

          if (targetRoomCode) {
            await saveRoomMessageToStorage(targetRoomCode, messagePayload);
          } else if (receiverKey) {
            await saveDirectMessageToStorage(messagePayload);
          }

          if (targetRoomCode && roomConnectionsMap.has(targetRoomCode)) {
            const clients = roomConnectionsMap.get(targetRoomCode);
            clients.forEach((clientSocket) => {
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify(messagePayload));
              }
            });
          } else {

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(messagePayload));
            }
          }

          if (receiverKey && directChatConnections.has(receiverKey)) {
            const receiverSocket = directChatConnections.get(receiverKey);
            if (receiverSocket && receiverSocket !== ws && receiverSocket.readyState === WebSocket.OPEN) {
              receiverSocket.send(JSON.stringify(messagePayload));
            }
          }
        } catch (error) {
          console.error("Native WS parsing error:", error);
        }
      });

      ws.on("close", () => {
        directChatConnections.delete(userKey);
        if (roomCode && roomConnectionsMap.has(roomCode)) {
          const clients = roomConnectionsMap.get(roomCode);
          clients.delete(ws);
          if (clients.size === 0) {
            roomConnectionsMap.delete(roomCode);
          }
        }
        console.log(`🔌 Native Chat WS disconnected: ${userKey}`);
      });
    } else if (pathname && pathname.includes("/notification")) {
      const rawEmail = query.email || "anonymous";
      const email = String(rawEmail).trim().toLowerCase();
      notificationConnections.set(email, ws);

      console.log(`🔔 Notification WS connected: ${email}`);

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

      ws.on("message", (message) => {

        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message.toString());
          }
        });
      });
    }
  });
};
