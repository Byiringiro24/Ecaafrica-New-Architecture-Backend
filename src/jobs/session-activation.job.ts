/**
 * Session Auto-Activation Job
 *
 * Runs every 60 seconds. Handles two independent activation paths:
 *
 * 1. Device Sessions (boarding/gate FK623 sessions)
 *    - For every device_session with attendance_windows, checks whether the
 *      current local time falls within any window.
 *    - Activates / deactivates automatically — no manual clicks needed.
 *    - Time format: attendance_windows.start_time / end_time are "HH:MM" VarChar(5).
 *
 * 2. Attendance Sessions (class teacher sessions)
 *    - For every attendance_session linked to a timetable_period, checks whether
 *      the current local time is within that period's start_time / end_time.
 *    - Sets started_at when the period begins (if not already set).
 *    - Sets submitted_at when the period ends (auto-submit) if not already submitted
 *      and the session has at least one attendance record.
 *    - This fixes: "Period 1 showing wrong time" and "Not Submitted" status.
 *
 * Time format for timetable_periods: DateTime @db.Time stored as 1970-01-01T{HH:MM}:00Z.
 * Comparison uses Africa/Kigali local time.
 */

import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';

const SWEEP_INTERVAL_MS = parseInt(
  process.env.SESSION_ACTIVATION_INTERVAL_MS ?? String(60_000),
  10
);

const TZ = process.env.TZ ?? 'Africa/Kigali';

/** Convert "HH:MM" string to total minutes since midnight. */
function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

/** Get current time in minutes since midnight, using the server TZ. */
function nowMinutes(): number {
  const now = new Date();
  // Format in the target timezone to get local HH:MM
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
    timeZone: TZ,
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  return h * 60 + m;
}

async function runActivationSweep(): Promise<void> {
  const currentMinutes = nowMinutes();

  // Load all sessions with their windows in a single query
  const sessions = await prisma.device_sessions.findMany({
    where: { deleted_at: null },
    select: {
      id:           true,
      name:         true,
      is_active:    true,
      activated_at: true,
      device_id:    true,
      school_id:    true,
      attendance_windows: {
        select: {
          start_time:    true,
          end_time:      true,
          grace_minutes: true,
        },
      },
    },
  });

  let activated   = 0;
  let deactivated = 0;

  for (const session of sessions) {
    // A session with no windows cannot auto-activate
    if (session.attendance_windows.length === 0) continue;

    // Session is "in window" if current time falls within ANY of its windows
    const inWindow = session.attendance_windows.some(w => {
      const start = hmToMinutes(w.start_time);
      const end   = hmToMinutes(w.end_time) + (w.grace_minutes ?? 0);
      if (start < 0 || end < 0) return false;
      return currentMinutes >= start && currentMinutes < end;
    });

    if (inWindow && !session.is_active) {
      // Transition: inactive → active
      await prisma.device_sessions.update({
        where: { id: session.id },
        data: {
          is_active:    true,
          activated_at: new Date(),
          updated_at:   new Date(),
        },
      });
      logger.info(
        { sessionId: session.id.toString(), name: session.name, deviceId: session.device_id.toString() },
        '[session-activation] Session auto-activated'
      );
      activated++;
    } else if (!inWindow && session.is_active) {
      // Transition: active → inactive
      await prisma.device_sessions.update({
        where: { id: session.id },
        data: {
          is_active:  false,
          updated_at: new Date(),
        },
      });
      logger.info(
        { sessionId: session.id.toString(), name: session.name, deviceId: session.device_id.toString() },
        '[session-activation] Session auto-deactivated'
      );
      deactivated++;
    }
    // No change if already in the correct state
  }

  if (activated > 0 || deactivated > 0) {
    logger.info(
      { activated, deactivated, totalChecked: sessions.length },
      '[session-activation] Device session sweep complete'
    );
  }
}

// ── Attendance Sessions (class teacher sessions) ──────────────────────────────

/**
 * Convert a timetable_periods DateTime @db.Time value to minutes since midnight.
 * These are stored as full DateTime with 1970-01-01 date prefix, UTC.
 * We extract just the HH:MM portion.
 */
function dbTimeToMinutes(dt: Date | null | undefined): number {
  if (!dt) return -1;
  // The DB Time type stores the time portion; getUTCHours/Minutes gives the correct value
  return dt.getUTCHours() * 60 + dt.getUTCMinutes();
}

/**
 * Auto-start and auto-submit class attendance sessions based on timetable_periods.
 *
 * - Sets started_at = now() when the current time enters the period window
 *   (only if started_at is null — never overwrite a teacher-set start).
 * - Sets submitted_at = now() when the current time passes the period end
 *   and the session has records but submitted_at is still null.
 *
 * This fixes:
 *   - "Period 1 attendance showing 11:50 AM" — was using created_at, now started_at
 *     is set to the actual period start time.
 *   - "Not Submitted" status on past periods — auto-submitted when period ends.
 */
async function runAttendanceSessionSweep(): Promise<void> {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Only process today's sessions that have a timetable period
  const sessions = await prisma.attendance_sessions.findMany({
    where: {
      session_date: todayDate,
      period_id:    { not: null },
    },
    select: {
      id:           true,
      started_at:   true,
      submitted_at: true,
      period_id:    true,
      school_id:    true,
      section_id:   true,
      period: {
        select: {
          start_time: true,
          end_time:   true,
          name:       true,
        },
      },
    },
  });

  if (sessions.length === 0) return;

  const currentMinutes = nowMinutes();
  let started   = 0;
  let submitted = 0;

  for (const session of sessions) {
    if (!session.period) continue;

    const periodStart = dbTimeToMinutes(session.period.start_time);
    const periodEnd   = dbTimeToMinutes(session.period.end_time);

    if (periodStart < 0 || periodEnd < 0) continue;

    // Transition: period has started, session not yet started
    const periodActive = currentMinutes >= periodStart && currentMinutes < periodEnd;
    if (periodActive && !session.started_at) {
      await prisma.attendance_sessions.update({
        where: { id: session.id },
        data:  { started_at: new Date() },
      });
      logger.info(
        { sessionId: session.id.toString(), period: session.period.name },
        '[session-activation] Attendance session auto-started'
      );
      started++;
    }

    // Transition: period has ended, session has records, not yet submitted
    const periodEnded = currentMinutes >= periodEnd;
    if (periodEnded && !session.submitted_at) {
      // Only auto-submit if there is at least one attendance record
      const recordCount = await prisma.attendance_records.count({
        where: { session_id: session.id },
      });
      if (recordCount > 0) {
        await prisma.attendance_sessions.update({
          where: { id: session.id },
          data:  { submitted_at: new Date() },
        });
        logger.info(
          { sessionId: session.id.toString(), period: session.period.name, recordCount },
          '[session-activation] Attendance session auto-submitted'
        );
        submitted++;
      }
    }
  }

  if (started > 0 || submitted > 0) {
    logger.info(
      { started, submitted, totalChecked: sessions.length },
      '[session-activation] Attendance session sweep complete'
    );
  }
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function startSessionActivationJob(): void {
  if (sweepTimer) return;

  logger.info(
    { intervalMs: SWEEP_INTERVAL_MS },
    '[session-activation] Auto-activation job started'
  );

  const runAll = async () => {
    await runActivationSweep().catch(err =>
      logger.error({ err }, '[session-activation] Device session sweep failed')
    );
    await runAttendanceSessionSweep().catch(err =>
      logger.error({ err }, '[session-activation] Attendance session sweep failed')
    );
  };

  // Run immediately on startup so UI shows correct state right away
  runAll();

  sweepTimer = setInterval(runAll, SWEEP_INTERVAL_MS);

  sweepTimer.unref?.();
}

export function stopSessionActivationJob(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
    logger.info('[session-activation] Auto-activation job stopped');
  }
}
