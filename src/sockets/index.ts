import type { Server } from "socket.io";
import { logger } from "../utils/logger";
import { registerNotificationSocket } from "./notification.socket";

export const registerSocketHandlers = (io: Server) => {
  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    registerNotificationSocket(socket);

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Socket disconnected");
    });
  });
};
