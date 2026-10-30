/**
 * Bridge SSE Listener Job
 *
 * Connects to each active tablet's bridge app via Server-Sent Events (SSE).
 * The bridge emits real-time attendance events the moment a student scans.
 * This relay gives <1 second attendance updates in the live monitor.
 *
 * The pull-log job continues as a fallback/sync safety net every 5 seconds.
 */

import http from 'http';
import https from 'https';
import { AttendanceStatus, DeviceMode, GateEventType, ScanMethod, Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { emitGateEvent } from '../sockets/notification.socket';
import { sendAttendanceNotification } from '../services/attendance/notification.service';
import {
  isAttendanceScheduled,
  normalizeLegacyAttendanceConfig,
  resolveDeviceAttendance,
  type DeviceAttendanceStatus
} from '../services/attendance/device-attendance-rules.service';
import { recordBoardingAttendanceScan } from '../services/boarding/boarding-attendance.service';
import { logger } from '../utils/logger';
import { fireAndLog } from '../utils/async';
import { v4 as uuidv4 } from 'uuid';

// Track active SSE connections per tablet
const activeConnections = new Map<string, { destroy: () => void; tabletId: string }>();

// Maximum simultaneous SSE connections to open per refresh cycle.
// With 100+ tablets, opening all at once would flood the server on startup.
const SSE_CONNECT_CONCURRENCY = parseInt(process.env.SSE_CONNECT_CONCURRENCY ?? '10', 10);

// Per-connection stagger delay in ms — spread connections across time
const SSE_CONNECT_STAGGER_MS = parseInt(process.env.SSE_CONNECT_STAGGER_MS ?? '200', 10);

// Track last seen log IDs to avoid duplicates from SSE + pull-log overlap.
const MAX_SEEN_LOG_IDS = parseInt(process.env.SSE_DEDUP_CACHE_SIZE ?? '10000', 10);
const seenLogIds = new Set<string>();

/** Map FK623 raw method codes → ScanMethod enum (matches tablet.service.ts exactly) */
function normalizeMethod(value: unknown): ScanMethod {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('face') || raw === '20') return ScanMethod.face;
  if (raw.includes('card') || raw.includes('rfid') || raw === '3') return ScanMethod.nfc;
  if (raw.includes('pin') || raw.includes('password') || raw === '2') return ScanMethod.manual;
  return ScanMethod.fingerprint;
}

/** Map raw direction value → GateEventType */
function normalizeDirection(value: unknown): GateEventType {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('out') || ['2', '4', '6', '8'].includes(raw)) return GateEventType.exit;
  return GateEventType.entry;
}

// ── Device context cache ─────────────────────────────────────────────────────
// We cache per-device context so we don't hit the DB on every SSE event.
// Cache TTL: 60 seconds — refreshed lazily when stale.

interface DeviceContext {
  deviceDbId: string;
  schoolId: bigint;
  mode: DeviceMode;
  dormitoryId: bigint | null;
  sessions: Array<{
    id: string;
    name: string;
    send_sms: boolean;
    is_active: boolean;
    auto_approve: boolean;
    notification_template_id: string | undefined;
    windows: Array<{ id: string; label: string; start_time: string; end_time: string }>;
  }>;
  fetchedAt: number;
}

const deviceContextCache = new Map<string, DeviceContext>();
const DEVICE_CONTEXT_TTL_MS = 60_000;

async function getDeviceContext(deviceId: string, schoolId: bigint): Promise<DeviceContext | null> {
  const cached = deviceContextCache.get(deviceId);
  if (cached && Date.now() - cached.fetchedAt < DEVICE_CONTEXT_TTL_MS) return cached;

  try {
    const device = await prisma.devices.findFirst({
      where: { device_uid: deviceId, school_id: schoolId },
      select: {
        id: true,
        attendance_config: true,
        mode: true,
        dormitory_id: true,
        device_sessions: {
          where: { deleted_at: null },
          select: {
            id: true,
            name: true,
            send_sms: true,
            is_active: true,
            auto_approve: true,
            notification_template_id: true,
            attendance_windows: {
              select: { id: true, label: true, start_time: true, end_time: true },
            },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!device) return null;

    const ctx: DeviceContext = {
      deviceDbId: device.id.toString(),
      schoolId,
      mode: device.mode,
      dormitoryId: device.dormitory_id,
      sessions: (device.device_sessions.length
        ? device.device_sessions
        : normalizeLegacyAttendanceConfig(device.attendance_config).map((session, index) => ({
            id: `legacy-${index}`,
            name: session.name,
            send_sms: true,
            is_active: false,
            auto_approve: true,
            notification_template_id: undefined,
            attendance_windows: session.windows.map((window, windowIndex) => ({
              id: `legacy-${index}-${windowIndex}`,
              label: window.label ?? 'Window',
              start_time: window.start ?? '00:00',
              end_time: window.end ?? '23:59'
            }))
          }))).map((s) => ({
        id: s.id.toString(),
        name: s.name,
        send_sms: s.send_sms,
        is_active: s.is_active ?? false,
        auto_approve: s.auto_approve ?? true,
        notification_template_id: s.notification_template_id?.toString(),
        windows: s.attendance_windows.map((w) => ({
          id: w.id.toString(),
          label: w.label,
          start_time: w.start_time,
          end_time: w.end_time,
        })),
      })),
      fetchedAt: Date.now(),
    };

    deviceContextCache.set(deviceId, ctx);
    return ctx;
  } catch (err) {
    logger.warn({ err, deviceId }, '[bridge-sse] Failed to load device context');
    return null;
  }
}

/** Invalidate cached context when a device is updated */
export function invalidateDeviceContext(deviceId: string): void {
  deviceContextCache.delete(deviceId);
}

// ── Session matching ─────────────────────────────────────────────────────────

interface SessionMatch {
  sessionName: string;
  statusLabel: string | null;
  attendanceStatus: DeviceAttendanceStatus;
  sendSms: boolean;
  autoApprove: boolean;
  notificationTemplateId: string | undefined;
}

function matchSession(ctx: DeviceContext, timestamp: Date): SessionMatch | null {
  const attendance = resolveDeviceAttendance(ctx.sessions, timestamp);
  const session = attendance.session ?? ctx.sessions[0] ?? null;
  if (!session && attendance.status !== 'not_scheduled') return null;
  return {
    sessionName: attendance.sessionName ?? session?.name ?? '',
    statusLabel: attendance.statusLabel,
    attendanceStatus: attendance.status,
    sendSms: session?.send_sms ?? false,
    autoApprove: session?.auto_approve ?? true,
    notificationTemplateId: session?.notification_template_id,
  };
}

// ── Core event processor ─────────────────────────────────────────────────────

/**
 * Process a single attendance event received from the bridge SSE stream.
 * Saves to gate_logs + attendance_logs, auto-creates boarding_attendance_records
 * when the device is in boarding mode, and emits to Socket.IO.
 */
async function processAttendanceEvent(
  event: any,
  schoolId: bigint,
  deviceId: string
): Promise<void> {
  try {
    const userId = String(event.studentDeviceId || event.userId || '').trim();
    const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
    const stableId = String(event.id || `${userId}-${timestamp.getTime()}`);

    // Skip if already processed (SSE + pull-log dedup)
    const dedupKey = `${deviceId}:${stableId}`;
    if (seenLogIds.has(dedupKey)) return;
    seenLogIds.add(dedupKey);
    if (seenLogIds.size > MAX_SEEN_LOG_IDS) {
      const first = seenLogIds.values().next().value;
      if (first) seenLogIds.delete(first);
    }

    if (!userId) return;

    // ── Load device context (cached) ─────────────────────────────────────────
    const ctx = await getDeviceContext(deviceId, schoolId);

    // ── Find or create student ───────────────────────────────────────────────
    let student = await prisma.students.findFirst({
      where: {
        school_id: schoolId,
        deleted_at: null,
        OR: [
          { device_user_id: userId },
          { student_id_number: userId },
        ],
      },
    });

    if (!student) {
      student = await prisma.students.create({
        data: {
          uuid: uuidv4(),
          school_id: schoolId,
          student_id_number: null,
          device_user_id: userId,
          first_name: 'Device',
          last_name: `User ${userId}`,
          device_sync_status: 'pending',
          last_device_sync: new Date(),
        },
      });
    }

    // ── Normalize scan attributes ────────────────────────────────────────────
    const scanMethod = normalizeMethod(event.authenticationMethod ?? event.method);
    const direction = normalizeDirection(event.direction ?? event.directionLabel);

    // ── Session matching ─────────────────────────────────────────────────────
    const sessionMatch = ctx ? matchSession(ctx, timestamp) : null;
    const sessionName = sessionMatch?.sessionName ?? event.attendancePeriod ?? null;
    const statusLabel = sessionMatch?.statusLabel ?? event.status ?? null;
    const attendanceStatus = sessionMatch?.attendanceStatus ?? AttendanceStatus.present;
    const gateAttendanceStatus = isAttendanceScheduled(attendanceStatus)
      ? attendanceStatus as AttendanceStatus
      : null;
    const autoApprove = sessionMatch?.autoApprove ?? true;
    const sendSms = sessionMatch?.sendSms ?? true;
    const notifTemplateId = sessionMatch?.notificationTemplateId;

    // ── Enrollment for class/section info ────────────────────────────────────
    const enrollment = await prisma.student_section_enrollments.findFirst({
      where: { school_id: schoolId, student_id: student.id, status: 'active' },
      orderBy: { enrolled_at: 'desc' },
      include: { section: { select: { name: true, class: { select: { name: true } } } } },
    });

    // ── Write gate_log with DB-level dedup ───────────────────────────────────
    // The unique index gate_logs_dedup_key on (device_id, student_id, event_type,
    // dedup_bucket) prevents duplicates from concurrent SSE + pull-log workers.
    // ON CONFLICT DO NOTHING means the second insert is silently skipped — no
    // TOCTOU race, no select-then-insert, no advisory lock needed.
    const gateLogInsertResult = await prisma.$executeRaw`
      INSERT INTO gate_logs
        (school_id, student_id, event_type, scan_method, scanned_at,
         device_id, attendance_status, session_name, status_label,
         synced_at, is_flagged, flag_reason, created_at)
      VALUES
        (${schoolId}, ${student.id}, ${direction}::"GateEventType",
         ${scanMethod}::"ScanMethod", ${timestamp},
         ${deviceId}, ${gateAttendanceStatus ? Prisma.sql`${gateAttendanceStatus}::"AttendanceStatus"` : Prisma.sql`NULL`},
         ${sessionName}, ${statusLabel},
         NOW(), ${!autoApprove}, ${autoApprove ? null : 'Pending attendance approval'},
         NOW())
      ON CONFLICT (device_id, student_id, event_type, dedup_bucket)
      WHERE device_id IS NOT NULL AND student_id IS NOT NULL
      DO NOTHING
    `;

    // Only fire boarding scan and SMS when this was a NEW gate log (not a dedup skip)
    const isNewGateLog = gateLogInsertResult > 0;
    if (isNewGateLog) {

      // ── Auto-create boarding attendance record if device is boarding mode ──
      if (ctx?.mode === DeviceMode.boarding && ctx.dormitoryId && isAttendanceScheduled(attendanceStatus)) {
        void recordBoardingAttendanceScan(
          schoolId,
          student.id,
          ctx.dormitoryId,
          timestamp,
        ).catch((err) =>
          logger.warn({ err, studentId: student!.id.toString() }, '[bridge-sse] boarding scan record failed')
        );
      } else if (ctx?.mode === DeviceMode.boarding && !ctx.dormitoryId) {
        // Device is in boarding mode but has no dormitory assigned — scans cannot
        // be recorded as boarding attendance. Admin must set dormitory_id on the
        // device in the school admin portal (Devices → Edit → Dormitory).
        logger.warn(
          { deviceId, studentId: student!.id.toString() },
          '[bridge-sse] BOARDING DEVICE HAS NO DORMITORY: set dormitory_id on this device to enable boarding attendance recording'
        );
      }

      // ── SMS notification ──────────────────────────────────────────────────
      if (sendSms && isAttendanceScheduled(attendanceStatus)) {
        fireAndLog(
          sendAttendanceNotification({
            schoolId,
            studentId: student.id,
            kind: direction === GateEventType.exit ? 'school_exit' : 'school_entry',
            occurredAt: timestamp,
            templateId: notifTemplateId,
            sourceType: 'gate_device',
            scopeKey: deviceId,
          }),
          "bridge-sse.sendAttendanceNotification"
        );
      }

      // ── Real-time socket event ────────────────────────────────────────────
      emitGateEvent(schoolId.toString(), {
        studentId: student.student_id_number ?? student.id.toString(),
        studentName: `${student.first_name} ${student.last_name}`.trim(),
        className: enrollment?.section.class.name ?? null,
        section: enrollment?.section.name ?? null,
        direction: String(direction),
        method: String(scanMethod),
        status: String(attendanceStatus),
        sessionName,
        deviceId,
        timestamp: timestamp.toISOString(),
        logId: stableId,
      });


      // Update device last_seen_at
      await prisma.devices.updateMany({
        where: { device_uid: deviceId, school_id: schoolId },
        data: { last_seen_at: new Date() },
      });

      // Mark tablet online — SSE receiving live events proves reachability
      await prisma.tablets.updateMany({
        where: {
          school_id: schoolId,
          devices: { some: { device_uid: deviceId } },
          deleted_at: null,
        },
        data: { status: 'online', last_health_check: new Date(), updated_at: new Date() },
      }).catch(() => null);
    }

    // ── Write attendance_logs (upsert — safe on retry) ───────────────────────
    await prisma.attendance_logs.upsert({
      where: { log_id_device_id: { log_id: stableId, device_id: deviceId } },
      update: {},
      create: {
        school_id: schoolId,
        log_id: stableId,
        user_id: userId,
        student_id: student.student_id_number ?? student.id.toString(),
        student_device_id: userId,
        student_name: `${student.first_name} ${student.last_name}`.trim(),
        class_name: enrollment?.section.class.name ?? null,
        section: enrollment?.section.name ?? null,
        device_id: deviceId,
        authentication_method: String(scanMethod),
        direction: String(direction),
        timestamp,
        status: String(attendanceStatus),
        attendance_period: sessionName,
        raw_data: event as any,
        sync_state: 'synced',
        is_flagged: !autoApprove,
        flag_reason: autoApprove ? null : 'Pending attendance approval',
        synced_at: new Date(),
      },
    });
  } catch (err) {
    logger.warn({ err }, '[bridge-sse] Failed to process attendance event');
  }
}

// ── SSE connection management ─────────────────────────────────────────────────

/**
 * Connect to a single tablet's SSE stream.
 * Reconnects automatically with exponential backoff on disconnect.
 */
function connectTabletSSE(
  tabletId: string,
  tabletUrl: string,
  schoolId: bigint,
  deviceId: string,
  attempt = 0
): void {
  const key = tabletId;

  // Don't double-connect
  if (activeConnections.has(key)) return;

  const url = new URL('/api/events', tabletUrl);
  const lib = url.protocol === 'https:' ? https : http;

  logger.debug({ tabletId, tabletUrl }, '[bridge-sse] Connecting to SSE stream');

  const req = lib.get(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { Accept: 'text/event-stream' },
      timeout: 5000,
    },
    (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        scheduleReconnect(tabletId, tabletUrl, schoolId, deviceId, attempt);
        return;
      }

      logger.info({ tabletId }, '[bridge-sse] SSE connected — real-time attendance active');
      attempt = 0; // reset backoff on success

      let buffer = '';
      let currentEvent = '';

      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim();
            if (currentEvent === 'attendance') {
              try {
                const events: any[] = JSON.parse(dataStr);
                for (const evt of Array.isArray(events) ? events : [events]) {
                  fireAndLog(
                    processAttendanceEvent(evt, schoolId, deviceId),
                    "bridge-sse.processAttendanceEvent"
                  );
                }
              } catch { /* malformed JSON — skip */ }
            }
            currentEvent = '';
          }
        }
      });

      res.on('end', () => {
        activeConnections.delete(key);
        logger.debug({ tabletId }, '[bridge-sse] SSE stream ended — reconnecting');
        scheduleReconnect(tabletId, tabletUrl, schoolId, deviceId, attempt + 1);
      });

      res.on('error', () => {
        activeConnections.delete(key);
        scheduleReconnect(tabletId, tabletUrl, schoolId, deviceId, attempt + 1);
      });
    }
  );

  req.on('error', () => {
    activeConnections.delete(key);
    scheduleReconnect(tabletId, tabletUrl, schoolId, deviceId, attempt + 1);
  });

  req.on('timeout', () => {
    req.destroy();
    activeConnections.delete(key);
    scheduleReconnect(tabletId, tabletUrl, schoolId, deviceId, attempt + 1);
  });

  activeConnections.set(key, { destroy: () => req.destroy(), tabletId });
}

function scheduleReconnect(
  tabletId: string,
  tabletUrl: string,
  schoolId: bigint,
  deviceId: string,
  attempt: number
): void {
  // Exponential backoff: 2s, 4s, 8s … capped at 30s
  const delay = Math.min(2000 * Math.pow(2, Math.min(attempt, 4)), 30_000);
  setTimeout(() => {
    connectTabletSSE(tabletId, tabletUrl, schoolId, deviceId, attempt);
  }, delay);
}

/**
 * Refresh SSE connections — called on startup and every 30 s.
 * Connects to any tablet that doesn't have an active SSE stream.
 * Connections are staggered and batched to avoid flooding 100+ tablets at once.
 */
async function refreshSSEConnections(): Promise<void> {
  try {
    const tablets = await prisma.tablets.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, school_id: true, url: true, ip: true, port: true },
    });

    const needConnect = tablets.filter((t) => !activeConnections.has(t.id.toString()));

    for (let i = 0; i < needConnect.length; i += SSE_CONNECT_CONCURRENCY) {
      const batch = needConnect.slice(i, i + SSE_CONNECT_CONCURRENCY);

      for (let j = 0; j < batch.length; j++) {
        const tablet = batch[j];
        const key = tablet.id.toString();

        if (activeConnections.has(key)) continue;

        const url = tablet.url || (tablet.ip ? `http://${tablet.ip}:${tablet.port ?? 5000}` : null);
        if (!url) continue;

        const device = await prisma.devices.findFirst({
          where: { tablet_id: tablet.id, school_id: tablet.school_id },
          select: { device_uid: true, id: true },
          orderBy: { updated_at: 'desc' },
        });

        const deviceId = device?.device_uid ?? device?.id.toString() ?? `TABLET-${key}`;

        if (j > 0 && SSE_CONNECT_STAGGER_MS > 0) {
          await new Promise((r) => setTimeout(r, SSE_CONNECT_STAGGER_MS));
        }

        connectTabletSSE(key, url, tablet.school_id, deviceId);
      }
    }

    // Disconnect SSE streams for tablets that are no longer active
    for (const [key, conn] of activeConnections.entries()) {
      const still = tablets.find((t) => t.id.toString() === key);
      if (!still) {
        conn.destroy();
        activeConnections.delete(key);
        logger.debug({ tabletId: key }, '[bridge-sse] Removed SSE for inactive tablet');
      }
    }
  } catch (err) {
    logger.warn({ err }, '[bridge-sse] Failed to refresh SSE connections');
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

export function startBridgeSSEJob(): void {
  if (refreshTimer) return;

  logger.info(
    { connectConcurrency: SSE_CONNECT_CONCURRENCY, staggerMs: SSE_CONNECT_STAGGER_MS },
    '[bridge-sse] Starting real-time SSE listener for all tablet bridges'
  );

  setTimeout(() => void refreshSSEConnections(), 3_000);
  refreshTimer = setInterval(() => void refreshSSEConnections(), 30_000);
  refreshTimer.unref?.();
}

export function stopBridgeSSEJob(): void {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  for (const conn of activeConnections.values()) conn.destroy();
  activeConnections.clear();
  logger.info('[bridge-sse] SSE listener stopped');
}

/**
 * Called when a tablet is reassigned to a new school.
 * Drops the old SSE connection so it reconnects with fresh school context.
 */
export function resetTabletSSE(tabletId: string | bigint): void {
  const key = tabletId.toString();
  const conn = activeConnections.get(key);
  if (conn) {
    conn.destroy();
    activeConnections.delete(key);
    logger.debug({ tabletId: key }, '[bridge-sse] SSE reset after tablet reassignment');
  }
}
