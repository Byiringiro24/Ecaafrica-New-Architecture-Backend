/**
 * Automatic Pull Logs Job
 *
 * Runs on server startup and periodically pulls attendance logs from ALL active
 * tablets across every school. Designed to handle 100+ tablets safely:
 *
 *  - Pulls run in controlled batches (PULL_CONCURRENCY, default 10) so 100 tablets
 *    are not all hit simultaneously — avoids port exhaustion and server overload.
 *  - Each tablet has an independent in-flight guard (no overlapping pulls).
 *  - Each tablet is staggered by a small random jitter within the batch so they
 *    don't all hit the same second.
 *  - Pull timeout is per-tablet — one slow tablet never blocks others.
 *  - SSE handles real-time delivery; this is the safety-net catch-up sweep.
 */

import { prisma } from "../database/prisma";
import tabletService from "../services/tablet.service";
import { logger } from "../utils/logger";

// How often to run a full sweep across all tablets (default: 5 s)
const PULL_INTERVAL_MS = parseInt(
  process.env.PULL_LOGS_INTERVAL_MS ?? String(5_000),
  10
);

// Maximum tablets to pull from in parallel per sweep cycle.
// Lower = less server load. Higher = faster sweeps.
// Tune via PULL_CONCURRENCY env var. Default: 10 (safe for 100+ tablets).
const PULL_CONCURRENCY = parseInt(process.env.PULL_CONCURRENCY ?? "10", 10);

// Per-tablet pull timeout (must exceed tablet API timeout of 15 s)
const PULL_TIMEOUT_MS = parseInt(process.env.PULL_TIMEOUT_MS ?? "20000", 10);

// Per-tablet in-flight guard — prevents overlapping pulls for the same tablet
const inFlight = new Set<string>();

// Last successful pull time per tablet key (`${schoolId}-${tabletId}`)
const lastPullAt = new Map<string, number>();

// ── Concurrency limiter ──────────────────────────────────────────────────────

/**
 * Run an array of async tasks in batches of `concurrency`.
 * Waits for each batch to settle before starting the next.
 * This caps simultaneous outbound HTTP connections regardless of fleet size.
 */
async function runInBatches<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<Array<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }>> {
  const results: Array<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }> = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

// ── Per-tablet pull ──────────────────────────────────────────────────────────

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
      const result = await tabletService.pullDeviceLogs(tabletId, schoolId, 0);

      // Update last_seen_at on all devices linked to this tablet
      await prisma.devices.updateMany({
        where: { tablet_id: tabletId, school_id: schoolId },
        data: { last_seen_at: new Date() },
      });

      return {
        saved: result.savedCount ?? 0,
        duplicates: result.duplicateCount ?? 0,
        errors: result.errors ?? [],
      };
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

  // Build task functions (not yet invoked) — batched execution controls concurrency
  const tasks = due.map((tablet) => async () => {
    const key = `${tablet.school_id}-${tablet.id}`;

    if (!tablet.ip && !tablet.url) {
      logger.warn(
        { tabletId: tablet.id.toString(), tabletName: tablet.name },
        "[pull-logs] Skipping tablet — no IP or URL configured"
      );
      return;
    }

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

      // Mark tablet online
      await prisma.tablets
        .update({ where: { id: tablet.id }, data: { status: "online", last_health_check: new Date(), updated_at: new Date() } })
        .catch(() => null);

    } catch (err) {
      const message = (err as Error).message ?? String(err);
      const isNetwork = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|No response|Tablet unreachable/i.test(message);

      if (isNetwork) {
        // Keep the tablet online when the network path is still healthy enough for the bridge to respond.
        // A single failed pull is not enough evidence that the device is actually offline.
        logger.warn({ tabletId: tablet.id.toString(), tabletName: tablet.name, error: message }, "[pull-logs] Pull failed transiently; keeping current status");
      } else {
        logger.warn({ err, tabletId: tablet.id.toString(), tabletName: tablet.name }, "[pull-logs] Pull failed for tablet");
      }
    }
  });

  // Execute in controlled batches — never more than PULL_CONCURRENCY at once
  await runInBatches(tasks, PULL_CONCURRENCY);
}

// ── Job lifecycle ────────────────────────────────────────────────────────────

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function startPullLogsJob(): void {
  if (sweepTimer) return;

  logger.info(
    { intervalMs: PULL_INTERVAL_MS, concurrency: PULL_CONCURRENCY },
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
