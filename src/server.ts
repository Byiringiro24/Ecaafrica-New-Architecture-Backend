import { createServer } from "http";
import { app } from "./app";
import { env } from "./configs/env";
import { initSocket } from "./configs/socket";
import { isQueueEnabled } from "./configs/queue";
import { isJobLeader } from "./jobs/leader";
import { startNotificationWorker } from "./jobs/notification.job";
import { startSmsWorker } from "./jobs/sms.job";
import { startPullLogsJob } from "./jobs/pull-logs.job";
import { startBridgeSSEJob } from "./jobs/bridge-sse.job";
import { startBoardingReconcileJob } from "./jobs/boarding-reconcile.job";
import { startSessionActivationJob } from "./jobs/session-activation.job";
import { startTabletHeartbeatJob } from "./jobs/tablet-heartbeat.job";
import { logger } from "./utils/logger";

// ── Global error safety net ───────────────────────────────────────────────────
// A stray void-promise rejection (e.g. flaky SMS provider) must never kill a
// cluster worker and take it out of the pool. Log it and continue.
process.on("unhandledRejection", (err) => {
  logger.error({ err }, "unhandled rejection — process continues");
});
// Truly uncaught synchronous exceptions are unrecoverable — exit so PM2 restarts.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception — exiting for PM2 restart");
  process.exit(1);
});

const leader = isJobLeader();
logger.info(
  { instance: process.env.NODE_APP_INSTANCE ?? "0", leader },
  "worker starting"
);

// ── Singleton jobs run on the leader instance only ─────────────────────────
if (leader) {
  if (isQueueEnabled()) {
    try {
      startNotificationWorker();
      startSmsWorker();
    } catch (error) {
      logger.warn({ err: error }, "Redis queue unavailable — notification jobs will run inline");
    }
  } else {
    logger.warn("REDIS_URL not set — notification jobs run inline when enqueued");
  }

  // Real-time attendance via SSE from bridge app (sub-second delivery)
  startBridgeSSEJob();

  // Pull-log job as 5s safety net (catches any logs SSE may have missed)
  startPullLogsJob();

  // Boarding reconciliation — auto-closes sessions at end of each attendance window
  startBoardingReconcileJob();

  // Device session auto-activation — activates/deactivates sessions by time window every 60s
  startSessionActivationJob();

  // Tablet heartbeat — pings every tablet every 2 min, updates tablets.status + devices.last_seen_at
  // Fixes: devices show offline even when WireGuard pings work and tablet is reachable
  startTabletHeartbeatJob();

  // Late return detection — flags and notifies DOD+patron+parent when student is overdue
  import("./jobs/late-return.job").then(({ startLateReturnJob }) => startLateReturnJob());
} else {
  logger.info(
    { instance: process.env.NODE_APP_INSTANCE },
    "skipping singleton jobs — not leader worker"
  );
}

const httpServer = createServer(app);

// Wrap in IIFE because CommonJS doesn't support top-level await.
// initSocket is async to connect the Redis adapter before listening.
void (async () => {
  await initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, leader }, `API listening on port ${env.PORT}`);
  });
})();

// ── Graceful shutdown on SIGTERM ───────────────────────────────────────────
// PM2 sends SIGTERM before forcefully killing. We stop accepting new requests,
// drain in-flight ones (30s max), then disconnect the DB and exit cleanly.
// This prevents killing a request mid-attendance-submission.
const shutdown = async (signal: string) => {
  logger.info({ signal }, "shutdown signal received — draining in-flight requests");
  httpServer.close(async () => {
    try {
      const { prisma } = await import("./database/prisma");
      await prisma.$disconnect();
      logger.info("DB disconnected — clean exit");
    } catch (err) {
      logger.warn({ err }, "DB disconnect error during shutdown");
    }
    process.exit(0);
  });

  // Force-exit after 30 seconds if drain takes too long
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out after 30s — forcing exit");
    process.exit(1);
  }, 30_000).unref();
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT",  () => void shutdown("SIGINT"));
