import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { env } from "./env";
import { registerSocketHandlers } from "../sockets";
import { logger } from "../utils/logger";

let io: Server | null = null;

const resolveCorsOrigins = () => {
  if (env.CORS_ORIGIN === "*") return "*";
  return env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
};

export const initSocket = async (httpServer: HttpServer) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: { origin: resolveCorsOrigins(), credentials: true }
  });

  // ── Redis adapter — required in cluster/multi-process mode ──────────────────
  // Without this, emitGateEvent() only reaches browsers whose WebSocket lands
  // on the same worker that processed the scan. With N workers you'd only reach
  // 1/N of clients. The adapter broadcasts across all workers via Redis pub/sub.
  if (env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: env.REDIS_URL });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info("Socket.IO Redis adapter enabled — real-time works across all cluster workers");
    } catch (err) {
      logger.error(
        { err },
        "Socket.IO Redis adapter FAILED — real-time will only reach 1 worker's clients. " +
        "Set a valid REDIS_URL to fix this."
      );
    }
  } else {
    // In development (single process) this is fine. In production cluster mode
    // it means real-time only works for clients on the same worker.
    if (env.NODE_ENV === "production") {
      logger.warn(
        "Socket.IO running WITHOUT Redis adapter in production. " +
        "Real-time events will not reach all connected browsers. " +
        "Set REDIS_URL to enable the adapter."
      );
    }
  }

  registerSocketHandlers(io);
  logger.info("Socket.IO initialized");

  return io;
};

export const getSocketServer = () => io;
