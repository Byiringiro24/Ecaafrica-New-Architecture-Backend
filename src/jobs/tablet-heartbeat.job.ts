/**
 * Tablet Heartbeat Job
 *
 * Pings every active tablet's /api/health every 2 minutes.
 * Updates tablets.status + devices.last_seen_at so the sidebar
 * shows correct online/offline state even when no scans are happening.
 *
 * This is the core fix for "devices show offline while WireGuard pings work":
 * - pull-logs updates last_seen_at only when logs are pulled
 * - bridge-sse updates last_seen_at only when a student scans
 * - This job pings every 2 minutes regardless of activity
 *
 * Only runs on the PM2 cluster leader instance (NODE_APP_INSTANCE === "0").
 */

import axios from 'axios';
import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';

const HEARTBEAT_INTERVAL_MS = parseInt(
  process.env.TABLET_HEARTBEAT_INTERVAL_MS ?? String(2 * 60 * 1000), // 2 minutes
  10
);

const PING_TIMEOUT_MS = 8000; // 8s per tablet

async function pingTablet(url: string): Promise<boolean> {
  try {
    const healthUrl = `${url.replace(/\/+$/, '')}/api/health`;
    const res = await axios.get(healthUrl, {
      timeout: PING_TIMEOUT_MS,
      validateStatus: () => true, // any HTTP response = reachable
    });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function runHeartbeatSweep(): Promise<void> {
  const tablets = await prisma.tablets.findMany({
    where: { is_active: true, deleted_at: null },
    select: { id: true, name: true, url: true, ip: true, port: true },
  });

  if (tablets.length === 0) return;

  let online = 0;
  let offline = 0;

  await Promise.all(
    tablets.map(async (tablet) => {
      // Build URL: prefer tablet.url, fall back to ip:port
      const url = tablet.url?.trim()
        || (tablet.ip ? `http://${tablet.ip}:${tablet.port ?? 5000}` : null);

      if (!url) {
        // No URL configured — cannot ping, leave status unchanged
        return;
      }

      const reachable = await pingTablet(url);

      // Update tablet status
      await prisma.tablets.update({
        where: { id: tablet.id },
        data: {
          status: reachable ? 'online' : 'offline',
          last_health_check: new Date(),
          updated_at: new Date(),
        },
      }).catch(() => null);

      // If reachable, also update last_seen_at on all linked devices
      // so the 10-minute grace window stays fresh
      if (reachable) {
        await prisma.devices.updateMany({
          where: { tablet_id: tablet.id },
          data: { last_seen_at: new Date() },
        }).catch(() => null);
        online++;
      } else {
        // Tablet is not reachable — mark linked devices as disconnected
        // so the sidebar dot correctly shows offline even if is_connected was
        // previously true from an old FK623 connection
        await prisma.devices.updateMany({
          where: { tablet_id: tablet.id },
          data: {
            is_connected: false,
            last_status_message: 'Tablet bridge unreachable — check WireGuard VPN',
          },
        }).catch(() => null);
        offline++;
      }
    })
  );

  if (online > 0 || offline > 0) {
    logger.debug(
      { online, offline, total: tablets.length },
      '[tablet-heartbeat] Sweep complete'
    );
  }
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startTabletHeartbeatJob(): void {
  if (heartbeatTimer) return;

  logger.info(
    { intervalMs: HEARTBEAT_INTERVAL_MS },
    '[tablet-heartbeat] Tablet heartbeat job started'
  );

  // Run immediately on startup
  runHeartbeatSweep().catch((err) =>
    logger.error({ err }, '[tablet-heartbeat] Initial sweep failed')
  );

  heartbeatTimer = setInterval(() => {
    runHeartbeatSweep().catch((err) =>
      logger.error({ err }, '[tablet-heartbeat] Sweep failed')
    );
  }, HEARTBEAT_INTERVAL_MS);

  heartbeatTimer.unref?.();
}

export function stopTabletHeartbeatJob(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    logger.info('[tablet-heartbeat] Tablet heartbeat job stopped');
  }
}
