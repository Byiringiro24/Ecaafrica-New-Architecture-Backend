/**
 * Boarding Attendance Reconciliation Job
 *
 * Runs every minute and checks all active attendance windows.
 * When a window's end_time + grace_minutes has passed for today,
 * it reconciles any open sessions for that window's dormitory:
 *   - Students still "missing" who have an approved leave → on_approved_leave
 *   - Everyone else still "missing" → missing_attendance
 *   - Persists totals on the session row
 *   - Triggers parent escalation SMS after escalation_mins
 *
 * This means school staff never have to manually close sessions —
 * it happens automatically at the configured time every day.
 */

import { prisma } from '../database/prisma';
import {
  reconcileBoardingAttendance,
  runEscalation,
} from '../services/boarding/boarding-attendance.service';
import { logger } from '../utils/logger';

// How often to check for windows that need reconciliation (default: 60 s)
const RECONCILE_INTERVAL_MS = parseInt(
  process.env.BOARDING_RECONCILE_INTERVAL_MS ?? String(60_000),
  10
);

// Day-of-week map: JS getDay() → lowercase abbreviation used in applicable_days
const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Convert a Prisma @db.Time DateTime to total minutes since midnight.
 * Prisma stores @db.Time as a Date with epoch date, hours and minutes valid.
 */
function timeToMinutes(t: Date): number {
  return t.getHours() * 60 + t.getMinutes();
}

async function runReconcileSweep(): Promise<void> {
  const now = new Date();
  const todayDay = DAY_ABBR[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Today's date at midnight — used to match session_date
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    // Load all active windows that apply today
    const windows = await prisma.boarding_attendance_windows.findMany({
      where: {
        is_active: true,
        applicable_days: { contains: todayDay },
      },
      select: {
        id: true,
        school_id: true,
        dormitory_id: true,
        end_time: true,
        grace_minutes: true,
        name: true,
      },
    });

    for (const win of windows) {
      // Effective close time = end_time + grace_minutes
      const closeMinutes = timeToMinutes(win.end_time) + (win.grace_minutes ?? 0);

      // Only act once the window has closed (current time is past close time)
      if (nowMinutes < closeMinutes) continue;

      // Don't act if the window closed more than 2 hours ago
      // (avoids re-triggering on the next day's sweep before midnight resets the date)
      if (nowMinutes > closeMinutes + 120) continue;

      // Find sessions for today's date that haven't been reconciled yet
      const sessions = await (prisma.boarding_attendance_sessions.findMany as any)({
        where: {
          school_id: win.school_id,
          session_date: todayDate,
          reconciled_at: null,
          ...(win.dormitory_id ? { dormitory_id: win.dormitory_id } : {}),
        },
        select: { id: true },
      });

      if (sessions.length === 0) continue;

      logger.info(
        {
          windowId: win.id.toString(),
          windowName: win.name,
          sessions: sessions.length,
          schoolId: win.school_id.toString(),
        },
        '[boarding-reconcile] Reconciling sessions after window close'
      );

      // Reconcile each open session
      for (const session of sessions) {
        try {
          await reconcileBoardingAttendance(session.id);
          logger.info(
            { sessionId: session.id.toString() },
            '[boarding-reconcile] Session reconciled'
          );
        } catch (err) {
          logger.warn(
            { err, sessionId: session.id.toString() },
            '[boarding-reconcile] Failed to reconcile session'
          );
        }
      }
    }

    // Run escalation sweep — notify parents of students still missing
    // after their session was reconciled (honours per-window escalation_mins)
    await runEscalation().catch((err) =>
      logger.warn({ err }, '[boarding-reconcile] Escalation sweep failed')
    );
  } catch (err) {
    logger.error({ err }, '[boarding-reconcile] Reconcile sweep failed');
  }
}

let reconcileTimer: ReturnType<typeof setInterval> | null = null;

export function startBoardingReconcileJob(): void {
  if (reconcileTimer) return;

  logger.info(
    { intervalMs: RECONCILE_INTERVAL_MS },
    '[boarding-reconcile] Auto-reconciliation job started'
  );

  // Initial run 10 s after startup (let other jobs settle first)
  const init = setTimeout(() => {
    runReconcileSweep().catch((err) =>
      logger.error({ err }, '[boarding-reconcile] Initial sweep failed')
    );
  }, 10_000);
  init.unref?.();

  // Recurring sweep every minute
  reconcileTimer = setInterval(() => {
    runReconcileSweep().catch((err) =>
      logger.error({ err }, '[boarding-reconcile] Scheduled sweep failed')
    );
  }, RECONCILE_INTERVAL_MS);
  reconcileTimer.unref?.();
}

export function stopBoardingReconcileJob(): void {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
    logger.info('[boarding-reconcile] Auto-reconciliation job stopped');
  }
}
