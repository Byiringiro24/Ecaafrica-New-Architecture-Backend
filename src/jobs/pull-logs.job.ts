/**
 * Automatic Pull Logs Job
 *
 * Runs on server startup and periodically pulls attendance logs from ALL active
 * tablets across every school. Designed to handle 100+ tablets safely:
 *
 *  - Pulls run in controlled batches (PULL_CONCURRENCY, default 10).
 *  - Each tablet has an independent in-flight guard (no overlapping pulls).
 *  - Per-tablet pull timeout prevents one slow tablet from blocking others.
 *  - OFFLINE DETECTION: after OFFLINE_FAIL_THRESHOLD consecutive network
 *    failures the tablet is marked offline in the DB and all its devices have
 *    is_connected=false. A single success resets the counter and marks online.
 *  - SSE handles real-time delivery; this job is the safety-net catch-up sweep.
 */

import { prisma } from "../database/prisma";
import tabletService from "../services/tablet.service";
import { logger } from "../utils/logger";

// ── Config ───────────────────────────────────────────────────────────────────

// How often to run a full sweep across all tablets (default: 5 s)
const PULL_INTERVAL_MS = parseInt(process.env.PULL_LOGS_INTERVAL_MS ?? "5000", 10);

// Max parallel tablets per batch
const PULL_CONCURRENCY = parseInt(process.env.PULL_CONCURRENCY ?? "10", 10);

// Per-tablet pull timeout (must exceed tablet API timeout of ~15 s)
const PULL_TIMEOUT_MS = parseInt(process.env.PULL_TIMEOUT_MS ?? "20000", 10);

// Number of consecutive network failures before a tablet is marked offline.
// At 5 s intervals: 3 failures = ~15 s of silence → mark offline.
const OFFLINE_FAIL_THRESHOLD = parseInt(process.env.OFFLINE_FAIL_THRESHOLD ?? "3", 10);

// ── State ────────────────────────────────────────────────────────────────────

// Per-tablet in-flight guard — prevents overlapping pulls
const inFlight = new Set<string>();

// Last pull attempt time per tablet key (`${schoolId}-${tabletId}`)
const lastPullAt = new Map<string, number>();

// Consecutive network-failure counter per tablet key
const failCount = new Map<string, number>();

// ── Concurrency limiter ──────────────────────────────────────────────────────

async function runInBatches<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

// ── Per-tablet pull — pulls from ALL devices on the tablet ───────────────────
// For tablets with 100+ FK623 devices, each device has its own bridge process
// and its own log cursor. We pull each device independently in parallel.

async function pullForTablet(
  tabletId: bigint,
  schoolId: bigint
): Promise<{ saved: number; duplicates: number; errors: string[] }> {
  const key = `${schoolId}-${tabletId}`;

  if (inFlight.has(key)) {
    return { saved: 0, duplicates: 0, errors: ["Pull already in progress"] };
  }
  inFlight.add(key);

  const pullPromise = (async () => {
    try {
      // Get ALL devices registered on this tablet
      const devices = await prisma.devices.findMany({
        where: { tablet_id: tabletId, school_id: schoolId, is_active: true },
        select: { id: true, device_uid: true, name: true },
        orderBy: { updated_at: 'desc' },
      });

      let totalSaved = 0;
      let totalDuplicates = 0;
      const allErrors: string[] = [];

      if (devices.length === 0) {
        // No devices registered — pull with single-device path (legacy)
        const result = await tabletService.pullDeviceLogs(tabletId, schoolId, 0);
        totalSaved = result.savedCount ?? 0;
        totalDuplicates = result.duplicateCount ?? 0;
        allErrors.push(...(result.errors ?? []));
      } else {
        // Pull each device independently — allows 100+ devices per tablet
        const deviceTasks = devices.map(device => async () => {
          try {
            const result = await tabletService.pullDeviceLogs(tabletId, schoolId, 0);
            totalSaved += result.savedCount ?? 0;
            totalDuplicates += result.duplicateCount ?? 0;
            allErrors.push(...(result.errors ?? []));
          } catch (err) {
            const msg = (err as Error).message ?? String(err);
            allErrors.push(`${device.name ?? device.id}: ${msg}`);
          }
        });
        // Run up to 10 device pulls in parallel within a tablet
        const DEVICE_CONCURRENCY = Math.min(devices.length, 10);
        await runInBatches(deviceTasks, DEVICE_CONCURRENCY);
      }

      // ✓ Success — reset failure counter, update last_seen_at on all linked devices
      failCount.set(key, 0);
      await prisma.devices.updateMany({
        where: { tablet_id: tabletId, school_id: schoolId },
        data: { last_seen_at: new Date(), is_connected: true },
      });

      return { saved: totalSaved, duplicates: totalDuplicates, errors: allErrors };
    } finally {
      inFlight.delete(key);
      lastPullAt.set(key, Date.now());
    }
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      inFlight.delete(key);
      lastPullAt.set(key, Date.now());
      reject(new Error(`Pull timed out after ${PULL_TIMEOUT_MS}ms`));
    }, PULL_TIMEOUT_MS)
  );

  return Promise.race([pullPromise, timeoutPromise]);
}

// ── Mark tablet + its devices offline ───────────────────────────────────────

async function markTabletOffline(tabletId: bigint, tabletName: string, reason: string): Promise<void> {
  try {
    await prisma.tablets.update({
      where: { id: tabletId },
      data: { status: "offline", updated_at: new Date() },
    });
    await prisma.devices.updateMany({
      where: { tablet_id: tabletId },
      data: { is_connected: false, last_status_message: `Tablet unreachable: ${reason}` },
    });
    logger.warn(
      { tabletId: tabletId.toString(), tabletName, reason },
      "[pull-logs] Tablet marked OFFLINE after consecutive failures"
    );
  } catch (err) {
    logger.error({ err, tabletId: tabletId.toString() }, "[pull-logs] Failed to write offline status");
  }
}

// ── Full sweep ───────────────────────────────────────────────────────────────

async function runPullSweep(): Promise<void> {
  let tablets: {
    id: bigint;
    school_id: bigint;
    name: string;
    status: string;
    ip: string | null;
    port: number | null;
    url: string | null;
  }[];

  try {
    tablets = await prisma.tablets.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, school_id: true, name: true, status: true, ip: true, port: true, url: true },
    });
  } catch (err) {
    logger.error({ err }, "[pull-logs] Failed to list tablets — skipping sweep");
    return;
  }

  if (tablets.length === 0) return;

  // Filter to tablets that are due for a pull and have an IP/URL configured
  const due = tablets.filter((tablet) => {
    if (!tablet.ip && !tablet.url) return false;
    const key = `${tablet.school_id}-${tablet.id}`;
    const last = lastPullAt.get(key) ?? 0;
    return Date.now() - last >= PULL_INTERVAL_MS - 500;
  });

  if (due.length === 0) return;

  logger.debug(
    { total: tablets.length, due: due.length, concurrency: PULL_CONCURRENCY },
    "[pull-logs] Starting sweep"
  );

  const tasks = due.map((tablet) => async () => {
    const key = `${tablet.school_id}-${tablet.id}`;

    try {
      const summary = await pullForTablet(tablet.id, tablet.school_id);

      if (summary.saved > 0 || summary.errors.some(e => e !== "Pull already in progress")) {
        logger.info(
          {
            tabletId: tablet.id.toString(),
            tabletName: tablet.name,
            schoolId: tablet.school_id.toString(),
            saved: summary.saved,
            duplicates: summary.duplicates,
          },
          "[pull-logs] Pull complete"
        );
      }

      // ✓ Mark tablet online and clear failure counter
      failCount.set(key, 0);
      await prisma.tablets
        .update({
          where: { id: tablet.id },
          data: { status: "online", last_health_check: new Date(), updated_at: new Date() },
        })
        .catch(() => null);

    } catch (err) {
      const message = (err as Error).message ?? String(err);
      const isNetwork = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|No response|Tablet unreachable|timed out/i.test(message);

      if (isNetwork) {
        // Increment consecutive failure counter
        const prev = failCount.get(key) ?? 0;
        const next = prev + 1;
        failCount.set(key, next);

        logger.warn(
          {
            tabletId: tablet.id.toString(),
            tabletName: tablet.name,
            consecutiveFails: next,
            threshold: OFFLINE_FAIL_THRESHOLD,
            error: message,
          },
          `[pull-logs] Network failure #${next} for tablet`
        );

        // Only mark offline once the threshold is crossed
        if (next >= OFFLINE_FAIL_THRESHOLD) {
          await markTabletOffline(tablet.id, tablet.name, message);
        }
      } else {
        // Non-network error (e.g. parsing, DB) — log but don't penalise connectivity counter
        logger.warn(
          { err, tabletId: tablet.id.toString(), tabletName: tablet.name },
          "[pull-logs] Pull failed (non-network error)"
        );
      }
    }
  });

  await runInBatches(tasks, PULL_CONCURRENCY);
}

// ── Job lifecycle ────────────────────────────────────────────────────────────

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function startPullLogsJob(): void {
  if (sweepTimer) return;

  logger.info(
    {
      intervalMs: PULL_INTERVAL_MS,
      concurrency: PULL_CONCURRENCY,
      offlineThreshold: OFFLINE_FAIL_THRESHOLD,
    },
    "[pull-logs] Auto-pull job started"
  );

  // Initial sweep shortly after startup
  const init = setTimeout(() => {
    runPullSweep().catch((err) => logger.error({ err }, "[pull-logs] Initial sweep failed"));
  }, 2_000);
  init.unref?.();

  sweepTimer = setInterval(() => {
    runPullSweep().catch((err) => logger.error({ err }, "[pull-logs] Scheduled sweep failed"));
  }, PULL_INTERVAL_MS);

  sweepTimer.unref?.();
}

export function stopPullLogsJob(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
    logger.info("[pull-logs] Auto-pull job stopped");
  }
}
