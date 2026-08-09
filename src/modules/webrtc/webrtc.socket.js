import { getOrCreateVoiceSession, removeVoiceSession } from "./webrtc.service.js";

export const initializeWebRTCSockets = (io) => {
  io.on("connection", (socket) => {
    // WebRTC Signaling: Join Voice Room
    socket.on("webrtc_join_room", async ({ roomId, userId }) => {
      if (!roomId || !userId) return;

      // Leave any previous voice rooms first
      socket.rooms.forEach((rId) => {
        if (rId !== socket.id && rId !== roomId) {
          removeVoiceSession(rId, userId);
          io.to(rId).emit("webrtc_user_left", {
            userId,
            socketId: socket.id,
            roomId: rId,
          });
          socket.leave(rId);
        }
      });

      socket.join(roomId);
      socket.userId = userId;
      socket.roomId = roomId;

      await getOrCreateVoiceSession(roomId, userId);

      // Fetch all existing active sockets currently in the room
      const roomSockets = await io.in(roomId).fetchSockets();

      // Deduplicate peers by userId and exclude self
      const uniquePeersMap = new Map();
      roomSockets.forEach((s) => {
        if (s.id !== socket.id && s.userId && s.userId !== userId) {
          uniquePeersMap.set(s.userId, s.id);
        }
      });

      const existingPeers = Array.from(uniquePeersMap.entries()).map(([peerUserId, peerSocketId]) => ({
        userId: peerUserId,
        socketId: peerSocketId,
      }));

      // Send existing active members list to the newly joined client
      socket.emit("webrtc_existing_users", existingPeers);

      // Notify other peers in the room that a new user joined
      socket.to(roomId).emit("webrtc_user_joined", {
        userId,
        socketId: socket.id,
      });

      console.log(`🎙️ WebRTC Peer ${userId} (${socket.id}) joined room: ${roomId}. Active peers: ${existingPeers.length}`);
    });

    // WebRTC Signaling: Forward SDP Offer
    socket.on("webrtc_offer", ({ targetSocketId, targetUserId, sdp, roomId }) => {
      const payload = { senderUserId: socket.userId, senderSocketId: socket.id, sdp, roomId };
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc_offer", payload);
      } else {
        socket.to(roomId).emit("webrtc_offer", payload);
      }
    });

    // WebRTC Signaling: Forward SDP Answer
    socket.on("webrtc_answer", ({ targetSocketId, targetUserId, sdp, roomId }) => {
      const payload = { senderUserId: socket.userId, senderSocketId: socket.id, sdp, roomId };
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc_answer", payload);
      } else {
        socket.to(roomId).emit("webrtc_answer", payload);
      }
    });

    // WebRTC Signaling: Forward ICE Candidate
    socket.on("webrtc_ice_candidate", ({ targetSocketId, candidate, roomId }) => {
      const payload = { senderUserId: socket.userId, senderSocketId: socket.id, candidate, roomId };
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc_ice_candidate", payload);
      } else {
        socket.to(roomId).emit("webrtc_ice_candidate", payload);
      }
    });

    // WebRTC Signaling: Toggle Mute / Microphones State
    socket.on("webrtc_mute_status", ({ roomId, isMuted }) => {
      socket.to(roomId).emit("webrtc_peer_mute_changed", {
        userId: socket.userId,
        isMuted,
      });
    });

    // WebRTC Signaling: Toggle Video Camera State
    socket.on("webrtc_video_status", ({ roomId, isVideoOn }) => {
      socket.to(roomId).emit("webrtc_peer_video_changed", {
        userId: socket.userId,
        isVideoOn,
      });
    });

    const handleLeave = () => {
      const userId = socket.userId;
      const socketId = socket.id;

      if (!userId) return;

      socket.rooms.forEach((roomId) => {
        if (roomId !== socket.id) {
          removeVoiceSession(roomId, userId);

          // Broadcast user left event to all remaining peers in room
          io.to(roomId).emit("webrtc_user_left", {
            userId,
            socketId,
            roomId,
          });

          console.log(`👋 WebRTC Peer ${userId} (${socketId}) left room: ${roomId}`);
        }
      });
    };

    // WebRTC Signaling: Leave Voice Room
    socket.on("webrtc_leave_room", () => {
      handleLeave();
      if (socket.roomId) {
        socket.leave(socket.roomId);
        socket.roomId = null;
      }
    });

    socket.on("disconnecting", handleLeave);
  });
};
