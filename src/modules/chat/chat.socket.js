import { createMessage } from "./chat.service.js";

export const initializeChatSockets = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 User connected to socket: ${socket.id}`);

    socket.on("join_room", (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    socket.on("leave_room", (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.id} left room: ${roomId}`);
    });

    socket.on("send_message", async (data) => {
      try {
        const { senderId, channelId, receiverId, content } = data;
        const message = await createMessage({ senderId, channelId, receiverId, content });

        if (channelId) {
          io.to(channelId).emit("receive_message", message);
        } else if (receiverId) {
          io.to(receiverId).emit("receive_message", message);
          socket.emit("receive_message", message);
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to send message via socket" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
    });
  });
};
