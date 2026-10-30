/**
 * Attendance Logs Service
 *
 * Reads from the `attendance_logs` table — the dedicated store for
 * device-generated (biometric) scan events. Data is written here by
 * the auto-pull job (tablet.service.pullDeviceLogs) and by the manual
 * attendance event endpoint.
 *
 * This is the single source of truth for what the frontend device-logs
 * page displays.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { utcDateRange } from "../../utils/date-range";

const toBigInt = (value: string | number | bigint): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttendanceLogsFilters = {
  startDate?: string;
  endDate?: string;
  studentId?: string;
  deviceId?: string;
  method?: string;       // authentication_method value
  status?: string;       // present | late | absent
  syncState?: string;    // synced | queued | failed
  search?: string;       // full-text match on student_name / student_id / class_name
  className?: string;    // filter on denormalised class_name column
  section?: string;      // filter on denormalised section column
  direction?: string;    // entry | exit (direction column)
};

export type AttendanceLogsPagination = {
  page: number;
  limit: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise the raw `authentication_method` string from the device
 * into a display-friendly label that matches the frontend enum.
 */
function normaliseMethod(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  const v = String(raw).toLowerCase().trim();
  if (v === "1" || v.includes("finger")) return "Fingerprint";
  if (v === "2" || v.includes("face")) return "Face Recognition";
  if (v === "3" || v.includes("card") || v.includes("rfid")) return "RFID Card";
  if (v === "4" || v.includes("pin") || v.includes("password")) return "Password/PIN";
  return raw;
}

/**
 * Normalise the raw `direction` string from the device.
 */
function normaliseDirection(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  const v = String(raw).toLowerCase().trim();
  if (v === "entry" || v === "in" || v === "1") return "In";
  if (v === "exit" || v === "out" || v === "2") return "Out";
  return raw;
}

/**
 * Map DB `sync_state` value to the frontend SyncState enum.
 */
function normaliseSyncState(raw: string | null | undefined): "Synced" | "Queued" | "Failed" {
  switch ((raw ?? "").toLowerCase()) {
    case "synced": return "Synced";
    case "pending":
    case "queued": return "Queued";
    case "failed": return "Failed";
    default: return "Synced";
  }
}

/**
 * Capitalise the attendance status for the frontend.
 */
function normaliseStatus(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  if (raw.toLowerCase() === "not_scheduled") return "Not scheduled";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

// ─── Format ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatLog(row: any) {
  return {
    id: row.id?.toString(),
    studentId: row.student_id ?? "",
    studentName: row.student_name ?? "Unknown",
    timestamp: row.timestamp?.toISOString?.() ?? row.timestamp ?? null,
    method: normaliseMethod(row.authentication_method),
    methodRaw: row.authentication_method ?? "",
    direction: normaliseDirection(row.direction),
    directionRaw: row.direction ?? "",
    className: row.class_name ?? null,
    section: row.section ?? null,
    deviceId: row.device_id ?? "",
    status: normaliseStatus(row.status),
    syncState: normaliseSyncState(row.sync_state),
    sessionName: row.attendance_period ?? null,
    statusLabel: row.attendance_period ?? null,
    flagged: row.is_flagged ?? false,
    flagReason: row.flag_reason ?? null,
    syncedAt: row.synced_at?.toISOString?.() ?? null,
    logId: row.log_id ?? null,
    schoolId: row.school_id?.toString() ?? null,
  };
}

// ─── Build WHERE clause ───────────────────────────────────────────────────────

function buildWhere(
  schoolId: string | number | bigint,
  filters: AttendanceLogsFilters
): Prisma.attendance_logsWhereInput {
  const where: Prisma.attendance_logsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.startDate || filters.endDate) {
    const range = filters.startDate && filters.endDate
      ? utcDateRange(filters.startDate, filters.endDate)
      : filters.startDate
        ? { start: new Date(filters.startDate), end: undefined }
        : { start: undefined, end: utcDateRange(filters.endDate!, filters.endDate!).end };
    where.timestamp = {
      ...(range.start ? { gte: range.start } : {}),
      ...(range.end ? { lt: range.end } : {})
    };
  }

  if (filters.deviceId) {
    where.device_id = filters.deviceId;
  }

  if (filters.method) {
    // We store the raw method from the device; match by normalised label
    const raw = filters.method.toLowerCase();
    if (raw.includes("finger")) {
      where.authentication_method = { contains: "finger", mode: "insensitive" };
    } else if (raw.includes("face")) {
      where.authentication_method = { contains: "face", mode: "insensitive" };
    } else if (raw.includes("card") || raw.includes("rfid")) {
      where.authentication_method = {
        OR: [
          { contains: "card", mode: "insensitive" as const },
          { contains: "rfid", mode: "insensitive" as const }
        ]
      } as Prisma.StringFilter;
    } else {
      where.authentication_method = { contains: raw, mode: "insensitive" };
    }
  }

  if (filters.status) {
    where.status = { equals: filters.status.toLowerCase(), mode: "insensitive" };
  }

  if (filters.syncState) {
    const mapped =
      filters.syncState.toLowerCase() === "synced" ? "synced"
        : filters.syncState.toLowerCase() === "queued" ? "pending"
          : "failed";
    where.sync_state = mapped;
  }

  if (filters.studentId) {
    where.OR = [
      { student_id: { contains: filters.studentId, mode: "insensitive" } },
      { student_device_id: { contains: filters.studentId, mode: "insensitive" } }
    ];
  }

  if (filters.search) {
    const term = filters.search.trim();
    where.OR = [
      { student_name: { contains: term, mode: "insensitive" } },
      { student_id: { contains: term, mode: "insensitive" } },
      { student_device_id: { contains: term, mode: "insensitive" } },
      { device_id: { contains: term, mode: "insensitive" } },
      { class_name: { contains: term, mode: "insensitive" } }
    ];
  }

  if (filters.className) {
    where.class_name = { contains: filters.className.trim(), mode: "insensitive" };
  }

  if (filters.section) {
    where.section = { contains: filters.section.trim(), mode: "insensitive" };
  }

  if (filters.direction) {
    const d = filters.direction.toLowerCase();
    where.direction = { contains: d === "in" || d === "entry" ? "in" : "out", mode: "insensitive" };
  }

  return where;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List attendance logs with filters and pagination.
 * Merges two sources:
 *  1. attendance_logs — populated by the tablet pull-logs job (device scans synced automatically)
 *  2. attendance_records with device scan_methods — populated when records arrive via the
 *     school backend (fingerprint/face/card attendance stored directly in attendance_records)
 * This ensures the Device Attendance page shows data even before the pull-logs job has run.
 */
export async function listAttendanceLogs(
  schoolId: string | number | bigint,
  filters: AttendanceLogsFilters,
  pagination: AttendanceLogsPagination
) {
  const where = buildWhere(schoolId, filters);
  const offset = (pagination.page - 1) * pagination.limit;

  // Source 1: attendance_logs (device pull-log sync)
  const [rows, total] = await prisma.$transaction([
    prisma.attendance_logs.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: offset,
      take: pagination.limit
    }),
    prisma.attendance_logs.count({ where })
  ]);

  // Source 2: attendance_records with device scan methods
  // Only merge if attendance_logs returned no data (to avoid duplicates).
  // This acts as a fallback for schools where pull-logs hasn't synced yet.
  let extraLogs: ReturnType<typeof formatLog>[] = [];
  if (rows.length === 0) {
    const recordWhere: Prisma.attendance_recordsWhereInput = {
      school_id: toBigInt(schoolId),
      // "card" is not a valid ScanMethod enum value — schema has: manual, nfc, qr, face, fingerprint
      scan_method: { in: ["fingerprint", "face", "nfc", "qr"] as any }
    };
    if (filters.startDate || filters.endDate) {
      const range = filters.startDate && filters.endDate
        ? utcDateRange(filters.startDate, filters.endDate)
        : { start: filters.startDate ? new Date(filters.startDate) : undefined, end: undefined };
      recordWhere.scanned_at = {
        ...(range.start ? { gte: range.start } : {}),
        ...(range.end ? { lt: range.end } : {})
      };
    }
    if (filters.deviceId) {
      // device_id is stored in the session for device-type records
      recordWhere.session = { school_id: toBigInt(schoolId) };
    }
    const deviceRecords = await prisma.attendance_records.findMany({
      where: recordWhere,
      include: {
        student: { select: { id: true, first_name: true, last_name: true, student_id_number: true } },
        session: {
          include: {
            section: { select: { id: true, name: true, full_name: true, class: { select: { name: true } } } }
          }
        }
      },
      orderBy: { scanned_at: "desc" },
      take: pagination.limit
    });
    extraLogs = deviceRecords.map((r) => ({
      id: `rec-${r.id.toString()}`,
      studentId: r.student?.student_id_number ?? r.student_id.toString(),
      studentName: r.student ? `${r.student.first_name} ${r.student.last_name}`.trim() : "Unknown",
      timestamp: r.scanned_at?.toISOString() ?? r.created_at.toISOString(),
      method: normaliseMethod(r.scan_method),
      methodRaw: r.scan_method ?? "",
      direction: "In",
      directionRaw: "entry",
      className: r.session?.section?.class?.name ?? null,
      section: r.session?.section?.full_name ?? r.session?.section?.name ?? null,
      deviceId: "",
      status: normaliseStatus(r.status),
      syncState: "Synced" as const,
      sessionName: r.session?.section?.full_name ?? null,
      statusLabel: normaliseStatus(r.status),
      flagged: false,
      flagReason: null,
      syncedAt: null,
      logId: null,
      schoolId: r.school_id.toString()
    }));
  }

  const allRows = rows.length > 0 ? rows.map(formatLog) : extraLogs;
  const allTotal = rows.length > 0 ? total : extraLogs.length;

  return {
    data: allRows,
    meta: {
      total: allTotal,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(allTotal / pagination.limit))
    }
  };
}

/**
 * Get today's attendance logs for a school.
 */
export async function getTodayAttendanceLogs(schoolId: string | number | bigint) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rows = await prisma.attendance_logs.findMany({
    where: {
      school_id: toBigInt(schoolId),
      timestamp: { gte: today, lt: tomorrow }
    },
    orderBy: { timestamp: "desc" }
  });

  return rows.map(formatLog);
}

/**
 * Aggregate statistics over the attendance_logs table.
 */
export async function getAttendanceLogStats(
  schoolId: string | number | bigint,
  filters: { startDate?: string; endDate?: string }
) {
  const where = buildWhere(schoolId, filters);

  const rows = await prisma.attendance_logs.findMany({
    where,
    select: {
      student_id: true,
      authentication_method: true,
      status: true,
      direction: true
    }
  });

  // Device scans can still be retained for the audit trail on weekends, but
  // not_scheduled events are not attendance and must not affect counters.
  const scheduledRows = rows.filter((row) => (row.status ?? "").toLowerCase() !== "not_scheduled");

  return {
    totalRecords: scheduledRows.length,
    uniqueStudents: new Set(scheduledRows.map((r) => r.student_id).filter(Boolean)).size,
    fingerprintCount: scheduledRows.filter((r) => normaliseMethod(r.authentication_method) === "Fingerprint").length,
    faceCount: scheduledRows.filter((r) => normaliseMethod(r.authentication_method) === "Face Recognition").length,
    cardCount: scheduledRows.filter((r) => normaliseMethod(r.authentication_method) === "RFID Card").length,
    passwordCount: scheduledRows.filter((r) => normaliseMethod(r.authentication_method) === "Password/PIN").length,
    checkInCount: scheduledRows.filter((r) => normaliseDirection(r.direction) === "In").length,
    checkOutCount: scheduledRows.filter((r) => normaliseDirection(r.direction) === "Out").length,
    // Gate-log backed accurate counts (deduplicated at DB level)
    // These are the authoritative numbers — gate_logs uses ON CONFLICT DO NOTHING
    // so each unique scan is counted only once regardless of SSE retries.
    gatePresent: await (async () => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd   = new Date(todayStart.getTime() + 86400000);
      const dateFilter = (filters.startDate || filters.endDate) ? {
        gte: filters.startDate ? new Date(filters.startDate) : todayStart,
        lt:  filters.endDate   ? new Date(new Date(filters.endDate).getTime() + 86400000) : todayEnd,
      } : { gte: todayStart, lt: todayEnd };
      const gateRows = await prisma.gate_logs.findMany({
        where: {
          school_id:  toBigInt(schoolId),
          scanned_at: dateFilter,
          student_id: { not: null },
          event_type: "entry",
          attendance_status: { not: null },
        },
        select: { student_id: true, attendance_status: true },
      });
      return new Set(gateRows.map((r) => r.student_id?.toString()).filter(Boolean)).size;
    })(),
  };
}
