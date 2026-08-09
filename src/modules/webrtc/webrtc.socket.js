import { getOrCreateVoiceSession, removeVoiceSession } from "./webrtc.service.js";

export const initializeWebRTCSockets = (io) => {
  io.on("connection", (socket) => {
    // WebRTC Signaling: Join Voice Room
    socket.on("webrtc_join_room", async ({ roomId, userId }) => {
      socket.join(roomId);
      socket.userId = userId;
      socket.roomId = roomId;

      await getOrCreateVoiceSession(roomId, userId);

      // Notify other peers in the room that a new user joined
      socket.to(roomId).emit("webrtc_user_joined", {
        userId,
        socketId: socket.id,
      });

      console.log(`🎙️ WebRTC Peer ${userId} (${socket.id}) joined room: ${roomId}`);
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

    // WebRTC Signaling: Leave Voice Room
    socket.on("webrtc_leave_room", () => {
      if (socket.roomId && socket.userId) {
        removeVoiceSession(socket.roomId, socket.userId);
        socket.to(socket.roomId).emit("webrtc_user_left", {
          userId: socket.userId,
          socketId: socket.id,
        });
        socket.leave(socket.roomId);
        console.log(`👋 WebRTC Peer ${socket.userId} left room: ${socket.roomId}`);
      }
    });

    socket.on("disconnect", () => {
      if (socket.roomId && socket.userId) {
        removeVoiceSession(socket.roomId, socket.userId);
        socket.to(socket.roomId).emit("webrtc_user_left", {
          userId: socket.userId,
          socketId: socket.id,
        });
      }
    });
  });
};
