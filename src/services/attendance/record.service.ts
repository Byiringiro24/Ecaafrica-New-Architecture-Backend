import { Prisma, type attendance_records, type attendance_sessions } from "@prisma/client";
import { AttendanceSessionType, AttendanceStatus, ScanMethod } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { utcDateRange, utcDayRange } from "../../utils/date-range";
import { sendAttendanceNotification } from "./notification.service";

type AttendanceMarkInput = {
  notes?: string;
  marked_by?: string | number | bigint;
};

type BulkAttendanceInput = Array<{
  studentId: string | number | bigint;
  status: AttendanceStatus;
  notes?: string;
}>;

type AttendanceRecordFilters = {
  session_id?: string | number | bigint;
  student_id?: string | number | bigint;
  class_id?: string | number | bigint;
  section_id?: string | number | bigint;
  status?: AttendanceStatus;
  student_type?: string;
  late?: boolean;
  grace?: boolean;
  date?: string;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatRecord = (record: attendance_records) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  session_id: record.session_id.toString(),
  student_id: record.student_id.toString(),
  marked_by: record.marked_by ? record.marked_by.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "scanned_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.attendance_recordsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.attendance_recordsOrderByWithRelationInput;
};

const ensureSession = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint,
  tx?: Prisma.TransactionClient
) => {
  const client = tx ?? prisma;
  const session = await client.attendance_sessions.findFirst({
    where: {
      id: toBigInt(sessionId),
      school_id: toBigInt(schoolId)
    }
  });

  if (!session) {
    throw new AppError("not_found", "Attendance session not found", 404);
  }

  return session;
};

const assertSessionOpen = (_session: attendance_sessions) => {
  // Sessions are intentionally not locked after submission.
  // A teacher must be able to come back and correct records at any time
  // (e.g., mark a student who was present but missed from the first submission,
  // or correct a wrong status). The submitted_at field is informational only —
  // it records when the teacher first completed the roll call.
  // No-op: removed the hard block so upserts always succeed.
};

const ensureStudent = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
  tx?: Prisma.TransactionClient
) => {
  const client = tx ?? prisma;
  const student = await client.students.findFirst({
    where: {
      id: toBigInt(studentId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }
};

export const markAttendance = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint,
  studentId: string | number | bigint,
  status: AttendanceStatus,
  scanMethod: ScanMethod,
  input: AttendanceMarkInput = {},
  tx?: Prisma.TransactionClient,
  notify = true
) => {
  const session = await ensureSession(schoolId, sessionId, tx);
  assertSessionOpen(session);
  await ensureStudent(schoolId, studentId, tx);
  const client = tx ?? prisma;

  const recordKey = {
    session_id: session.id,
    student_id: toBigInt(studentId)
  };
  const update = {
    status,
    scan_method: scanMethod,
    scanned_at: new Date(),
    notes: input.notes,
    marked_by: input.marked_by ? toBigInt(input.marked_by) : undefined
  };

  let saved: attendance_records;
  try {
    saved = await client.attendance_records.upsert({
      where: { session_id_student_id: recordKey },
      update,
      create: {
        school_id: toBigInt(schoolId),
        ...recordKey,
        ...update
      }
    });
  } catch (error) {
    // Prisma can still surface P2002 when two requests perform the first
    // upsert for the same student at the same time. The row now exists, so an
    // update is the correct idempotent result for the losing request.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    saved = await client.attendance_records.update({
      where: { session_id_student_id: recordKey },
      data: update
    });
  }

  if (
    notify &&
    (status === AttendanceStatus.present ||
      status === AttendanceStatus.late ||
      status === AttendanceStatus.absent ||
      status === AttendanceStatus.excused)
  ) {
    void sendAttendanceNotification({
      schoolId,
      studentId,
      kind:
        status === AttendanceStatus.absent
          ? "class_absent"
          : status === AttendanceStatus.late
            ? "class_late"
            : status === AttendanceStatus.excused
              ? "class_excused"
              : "class_entry",
      occurredAt: saved.scanned_at ?? saved.created_at,
      sourceType: "classroom_manual",
      scopeKey: session.id.toString(),
      context: {
        attendance_status: status,
        status
      }
    });
  }

  return formatRecord(saved);
};

export const bulkMarkAttendance = async (
  schoolId: string | number | bigint,
  records: BulkAttendanceInput,
  sessionId: string | number | bigint,
  scanMethod: ScanMethod,
  markedBy?: string | number | bigint,
  notify = true
) => {
  await ensureSession(schoolId, sessionId);

  // Deduplicate — keep the last submitted status per student so a roster
  // that contains the same student twice never races against itself.
  const uniqueRecords = Array.from(
    new Map(
      records.map((r) => [toBigInt(r.studentId).toString(), r])
    ).values()
  );

  // Each upsert maps to a single  INSERT … ON CONFLICT (session_id, student_id)
  // DO UPDATE  statement at the Postgres level.  Two concurrent requests for the
  // same student in the same session will race at the DB, one wins the INSERT,
  // the other hits the conflict branch and runs the UPDATE — both succeed, no
  // error is ever thrown.  No transaction, no lock, fully concurrent.
  const saved = await Promise.all(
    uniqueRecords.map((record) =>
      markAttendance(
        schoolId,
        sessionId,
        record.studentId,
        record.status,
        scanMethod,
        { notes: record.notes, marked_by: markedBy },
        undefined,   // no tx — each upsert is independently atomic
        notify
      )
    )
  );

  return saved;
};

export const getAbsentees = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint
) => {
  await ensureSession(schoolId, sessionId);

  const presentRecords = await prisma.attendance_records.findMany({
    where: {
      school_id: toBigInt(schoolId),
      session_id: toBigInt(sessionId),
      status: {
        in: [AttendanceStatus.present, AttendanceStatus.late, AttendanceStatus.excused]
      }
    },
    select: {
      student_id: true
    }
  });

  const presentIds = presentRecords.map((item) => item.student_id);

  const absentees = await prisma.students.findMany({
    where: {
      school_id: toBigInt(schoolId),
      deleted_at: null,
      id: {
        notIn: presentIds.length ? presentIds : undefined
      }
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      student_id_number: true
    }
  });

  return absentees.map((student) => ({
    id: student.id.toString(),
    first_name: student.first_name,
    last_name: student.last_name,
    admission_no: student.student_id_number
  }));
};

export const getAttendanceSummary = async (
  schoolId: string | number | bigint,
  dateRange: { startDate: string; endDate: string }
) => {
  const { start: startDate, end: endDate } = utcDateRange(
    dateRange.startDate,
    dateRange.endDate
  );

  const sessionDateFilter = {
    gte: startDate,
    lt: endDate
  } as const;

  const sessions = await prisma.attendance_sessions.findMany({
    where: {
      school_id: toBigInt(schoolId),
      session_type: AttendanceSessionType.class,
      session_date: sessionDateFilter
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, name: true } },
      period: { select: { id: true, name: true } },
      section: {
        select: {
          id: true,
          name: true,
          full_name: true,
          class: { select: { name: true } },
          student_section_enrollments: {
            where: { status: "active", student: { deleted_at: null } },
            select: { student_id: true }
          }
        }
      }
    }
  });

  const records = await prisma.attendance_records.findMany({
    where: {
      school_id: toBigInt(schoolId),
      // Include ALL scan methods (manual teacher + device fingerprint/face/card)
      // so the summary reflects the complete picture for each session.
      session: {
        session_date: sessionDateFilter
      }
    },
    select: {
      session_id: true,
      status: true
    }
  });

  const sessionById = new Map(sessions.map((session) => [session.id.toString(), session]));
  const byGroup = new Map<string, {
    className: string; subjectName: string; teacherName: string; periodName: string; total: number;
    present: number; late: number; absent: number; submittedAt: Date | null;
    sessionDate: Date; startedAt: Date | null; sessionId: string;
  }>();

  sessions.forEach((session) => {
    const section = session.section;
    byGroup.set(session.id.toString(), {
      className: section.full_name || `${section.class.name}${section.name}`,
      subjectName: session.subject?.name ?? "No subject",
      teacherName: session.teacher?.name ?? "Unknown teacher",
      periodName: session.period?.name ?? "No period",
      total: section.student_section_enrollments.length,
      present: 0,
      late: 0,
      absent: 0,
      submittedAt: session.submitted_at,
      sessionDate: session.session_date,
      startedAt: session.started_at,
      sessionId: session.id.toString()
    });
  });

  records.forEach((record) => {
    const session = sessionById.get(record.session_id.toString());
    if (!session) return;
    const groupKey = `${session.id.toString()}`;
    const row = byGroup.get(groupKey);
    if (!row) return;
    if (record.status === AttendanceStatus.present) row.present += 1;
    if (record.status === AttendanceStatus.late) row.late += 1;
    if (record.status === AttendanceStatus.absent) row.absent += 1;
    byGroup.set(groupKey, row);
  });

  const summary = records.reduce(
    (acc, record) => {
      acc.total += 1;
      if (record.status === AttendanceStatus.present) acc.present += 1;
      if (record.status === AttendanceStatus.absent) acc.absent += 1;
      if (record.status === AttendanceStatus.late) acc.late += 1;
      if (record.status === AttendanceStatus.excused) acc.excused += 1;
      return acc;
    },
    { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
  );

  return {
    ...summary,
    teachers: new Set(sessions.filter((session) => session.teacher_id).map((session) => session.teacher_id?.toString())).size,
    classes: new Set(sessions.map((session) => session.section_id.toString())).size,
    sessions: sessions.length,
    details: Array.from(byGroup.values())
  };
};

export const findAllAttendanceRecords = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: AttendanceRecordFilters = {}
) => {
  const { page, limit, sort, order } = pagination;

  const where: Prisma.attendance_recordsWhereInput = {
    school_id: toBigInt(schoolId)
    // Deliberately NOT filtering by scan_method here — all attendance types
    // (manual teacher, fingerprint, face, card) must appear in reports.
  };

  const sessionWhere: Prisma.attendance_sessionsWhereInput = {};

  if (filters.session_id) where.session_id = toBigInt(filters.session_id);
  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.status) where.status = filters.status;
  if (filters.student_type) {
    where.student = { student_type: filters.student_type as any };
  }
  if (filters.class_id) {
    sessionWhere.section = { class_id: toBigInt(filters.class_id) };
  }
  if (filters.section_id) {
    sessionWhere.section_id = toBigInt(filters.section_id);
  }
  if (filters.late || filters.grace) {
    where.status = AttendanceStatus.late;
  }
  if (filters.date) {
    const { start, end } = utcDayRange(filters.date);
    sessionWhere.session_date = { gte: start, lt: end };
  } else if ((filters as any).start_date || (filters as any).end_date) {
    // Date range filter — used by Summary Report tab
    const startStr = (filters as any).start_date as string | undefined;
    const endStr   = (filters as any).end_date   as string | undefined;
    const rangeStart = startStr ? utcDayRange(startStr).start : undefined;
    const rangeEnd   = endStr   ? utcDayRange(endStr).end     : undefined;
    if (rangeStart || rangeEnd) {
      sessionWhere.session_date = {
        ...(rangeStart ? { gte: rangeStart } : {}),
        ...(rangeEnd   ? { lt:  rangeEnd   } : {})
      };
    }
  }
  // Filters: teacher, period, subject, session_type for per-session reports
  if ((filters as any).teacher_id) {
    sessionWhere.teacher_id = toBigInt((filters as any).teacher_id);
  }
  if ((filters as any).period_id) {
    sessionWhere.period_id = toBigInt((filters as any).period_id);
  }
  if ((filters as any).subject_id) {
    sessionWhere.subject_id = toBigInt((filters as any).subject_id);
  }
  if ((filters as any).session_type) {
    sessionWhere.session_type = (filters as any).session_type;
  }
  if (Object.keys(sessionWhere).length > 0) {
    where.session = sessionWhere;
  }

  const [items, total] = await prisma.$transaction([
    prisma.attendance_records.findMany({
      where,
      include: {
        // Include session details so reports can show teacher, period, subject
        session: {
          include: {
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true } },
            period: { select: { id: true, name: true } },
            section: { select: { id: true, name: true, full_name: true } }
          }
        }
      },
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.attendance_records.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatRecord(item),
      // Enrich with session context so frontends can group by teacher/period/subject
      session_date: (item as any).session?.session_date ?? null,
      teacher_name: (item as any).session?.teacher?.name ?? null,
      period_name: (item as any).session?.period?.name ?? null,
      subject_name: (item as any).session?.subject?.name ?? null,
      section_name: (item as any).session?.section?.full_name ?? (item as any).session?.section?.name ?? null,
    })),
    meta: { page, limit, total }
  };
};

export const findAttendanceRecordById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid attendance record id", 400);
  }

  const record = await prisma.attendance_records.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      scan_method: ScanMethod.manual
    }
  });

  if (!record) {
    throw new AppError("not_found", "Attendance record not found", 404);
  }

  return formatRecord(record);
};

export const deleteAttendanceRecord = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid attendance record id", 400);
  }

  const existing = await prisma.attendance_records.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      scan_method: ScanMethod.manual
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Attendance record not found", 404);
  }

  const session = await ensureSession(schoolId, existing.session_id);
  assertSessionOpen(session);

  await prisma.attendance_records.delete({
    where: { id: existing.id }
  });

  return formatRecord(existing);
};

type DeviceLogFilters = {
  startDate?: string;
  endDate?: string;
  studentId?: string | number | bigint;
  deviceId?: string;
  method?: string;
  status?: AttendanceStatus;
  syncState?: string;
  search?: string;
};

type BiometricMethod = "Fingerprint" | "Password/PIN" | "RFID Card" | "Face Recognition" | "Unknown";
type Direction = "In" | "Out" | "Unknown";
type SyncState = "Synced" | "Queued" | "Failed";

interface DeviceLog {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  method: BiometricMethod;
  methodRaw: string;
  direction: Direction;
  directionRaw: string;
  className?: string;
  section?: string;
  club?: string;
  deviceId: string;
  tabletId?: string;
  status: string;
  syncState: SyncState;
  sessionName?: string;
  statusLabel?: string;
  flagged: boolean;
  flagReason?: string;
  syncedAt?: string;
}

const METHOD_MAP: Record<string, BiometricMethod> = {
  fingerprint: "Fingerprint",
  "1": "Fingerprint",
  nfc: "RFID Card",
  "2": "Password/PIN",
  manual: "Password/PIN",
  qr: "RFID Card",
  "3": "RFID Card",
  face: "Face Recognition",
  "20": "Face Recognition"
};

const METHOD_FILTER_MAP: Record<string, ScanMethod | null> = {
  fingerprint: ScanMethod.fingerprint,
  face: ScanMethod.face,
  "face recognition": ScanMethod.face,
  manual: ScanMethod.manual,
  "password/pin": ScanMethod.manual,
  nfc: ScanMethod.nfc,
  "rfid card": ScanMethod.nfc,
  qr: ScanMethod.qr
};

const DIRECTION_MAP: Record<string, Direction> = {
  entry: "In",
  exit: "Out",
  in: "In",
  out: "Out",
  "1": "In",
  "2": "Out",
  "3": "In",
  "4": "Out",
  "5": "In",
  "6": "Out",
  "7": "In",
  "8": "Out"
};

const STATUS_MAP: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused"
};

const SYNC_STATE_MAP: Record<string, SyncState> = {
  synced: "Synced",
  queued: "Queued",
  failed: "Failed"
};

const normalizeMethod = (raw?: string | null): BiometricMethod => {
  if (!raw) return "Unknown";
  return METHOD_MAP[raw.toLowerCase()] ?? "Unknown";
};

const normalizeDirection = (raw?: string | null): Direction => {
  if (!raw) return "Unknown";
  return DIRECTION_MAP[raw.toLowerCase()] ?? "Unknown";
};

const normalizeStatus = (raw?: string | null) => {
  if (!raw) return "Present";
  const normalized = raw.toLowerCase();
  return STATUS_MAP[normalized] ?? raw;
};

const normalizeSyncState = (raw?: string | null): SyncState => {
  if (!raw) return "Synced";
  return SYNC_STATE_MAP[raw.toLowerCase()] ?? "Synced";
};

const resolveMethodFilter = (value: string) => METHOD_FILTER_MAP[value.toLowerCase()] ?? null;

type AttendanceRecordLogRow = {
  id: bigint;
  scanned_at: Date | null;
  status: AttendanceStatus;
  scan_method: ScanMethod;
  created_at: Date;
  updated_at: Date;
  notes: string | null;
  student: {
    id: bigint;
    first_name: string;
    last_name: string;
    student_id_number: string | null;
  };
  session: {
    session_date: Date;
    notes: string | null;
    period: {
      name: string;
    } | null;
    section: {
      name: string;
      full_name: string | null;
      class: {
        name: string;
      };
    };
  };
};

const buildAttendanceRecordWhere = (
  schoolId: string | number | bigint,
  filters: {
    startDate?: string;
    endDate?: string;
    studentId?: string | number | bigint;
    deviceId?: string;
    status?: AttendanceStatus | string;
    method?: string;
    search?: string;
  } = {}
) => {
  const conditions: Prisma.attendance_recordsWhereInput[] = [
    { school_id: toBigInt(schoolId) },
    { scan_method: { in: [ScanMethod.fingerprint, ScanMethod.face] } }
  ];

  if (filters.startDate || filters.endDate) {
    const scannedAt: Prisma.DateTimeFilter = {};
    if (filters.startDate) {
      scannedAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setDate(endDate.getDate() + 1);
      scannedAt.lt = endDate;
    }
    conditions.push({ scanned_at: scannedAt });
  }

  if (filters.studentId) {
    const studentId = String(filters.studentId).trim();
    const studentConditions: Prisma.attendance_recordsWhereInput[] = [];

    if (/^\d+$/.test(studentId)) {
      studentConditions.push({ student_id: toBigInt(studentId) });
    }

    studentConditions.push({
      student: {
        OR: [
          { student_id_number: { contains: studentId, mode: "insensitive" } },
          { first_name: { contains: studentId, mode: "insensitive" } },
          { last_name: { contains: studentId, mode: "insensitive" } }
        ]
      }
    });

    conditions.push({ OR: studentConditions });
  }

  if (filters.deviceId) {
    const deviceId = filters.deviceId.trim();
    conditions.push({
      OR: [
        { session: { section: { full_name: { contains: deviceId, mode: "insensitive" } } } },
        { session: { section: { name: { contains: deviceId, mode: "insensitive" } } } },
        { session: { section: { class: { name: { contains: deviceId, mode: "insensitive" } } } } },
        { session: { period: { name: { contains: deviceId, mode: "insensitive" } } } }
      ]
    });
  }

  if (filters.status) {
    conditions.push({ status: filters.status as AttendanceStatus });
  }

  if (filters.method) {
    const method = resolveMethodFilter(filters.method);
    if (method) {
      conditions.push({ scan_method: method });
    }
  }

  if (filters.search) {
    const search = filters.search.trim();
    conditions.push({
      OR: [
        { student: { first_name: { contains: search, mode: "insensitive" } } },
        { student: { last_name: { contains: search, mode: "insensitive" } } },
        { student: { student_id_number: { contains: search, mode: "insensitive" } } },
        { session: { section: { full_name: { contains: search, mode: "insensitive" } } } },
        { session: { section: { name: { contains: search, mode: "insensitive" } } } },
        { session: { section: { class: { name: { contains: search, mode: "insensitive" } } } } },
        { notes: { contains: search, mode: "insensitive" } }
      ]
    });
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
};

const formatDeviceLog = (log: AttendanceRecordLogRow): DeviceLog => ({
  id: String(log.id),
  studentId: log.student.student_id_number ?? log.student.id.toString(),
  studentName: `${log.student.first_name} ${log.student.last_name}`.trim(),
  timestamp: (log.scanned_at ?? log.created_at).toISOString(),
  method: normalizeMethod(log.scan_method),
  methodRaw: log.scan_method,
  direction: "In",
  directionRaw: "attendance_records",
  className: log.session.section.class.name ?? undefined,
  section: log.session.section.full_name ?? log.session.section.name,
  club: undefined,
  deviceId: log.session.period?.name ?? log.session.section.full_name ?? log.session.section.name ?? "Attendance",
  tabletId: undefined,
  status: normalizeStatus(log.status),
  syncState: "Synced",
  sessionName: log.session.period?.name ?? undefined,
  statusLabel: undefined,
  flagged: false,
  flagReason: undefined,
  syncedAt: log.updated_at.toISOString()
});

export const findGateLogsForSchool = async (
  schoolId: string | number | bigint,
  filters: DeviceLogFilters,
  pagination: { page: number; limit: number }
) => {
  const whereClause = buildAttendanceRecordWhere(schoolId, filters);
  const offset = (pagination.page - 1) * pagination.limit;

  const [logs, totalResult] = await prisma.$transaction([
    prisma.attendance_records.findMany({
      where: whereClause,
      orderBy: [{ scanned_at: "desc" }, { created_at: "desc" }],
      skip: offset,
      take: pagination.limit,
      select: {
        id: true,
        scanned_at: true,
        status: true,
        scan_method: true,
        created_at: true,
        updated_at: true,
        notes: true,
        student: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            student_id_number: true
          }
        },
        session: {
          select: {
            session_date: true,
            notes: true,
            period: {
              select: {
                name: true
              }
            },
            section: {
              select: {
                name: true,
                full_name: true,
                class: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.attendance_records.count({ where: whereClause })
  ]);

  const total = totalResult;

  return {
    data: logs.map(formatDeviceLog),
    meta: {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    }
  };
};

/**
 * Fetch today's gate logs for a school
 */
export const findTodayGateLogs = async (
  schoolId: string | number | bigint
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const logs = await prisma.attendance_records.findMany({
    where: {
      school_id: toBigInt(schoolId),
      scan_method: {
        in: [ScanMethod.fingerprint, ScanMethod.face]
      },
      scanned_at: {
        gte: today,
        lt: tomorrow
      }
    },
    orderBy: [{ scanned_at: "desc" }, { created_at: "desc" }],
    select: {
      id: true,
      scanned_at: true,
      status: true,
      scan_method: true,
      created_at: true,
      updated_at: true,
      notes: true,
      student: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          student_id_number: true
        }
      },
      session: {
        select: {
          session_date: true,
          notes: true,
          period: {
            select: {
              name: true
            }
          },
          section: {
            select: {
              name: true,
              full_name: true,
              class: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  return logs.map(formatDeviceLog);
};

/**
 * Get attendance statistics from device attendance logs
 */
export const getAttendanceStats = async (
  schoolId: string | number | bigint,
  filters: { startDate?: string; endDate?: string }
) => {
  const logs = await prisma.attendance_records.findMany({
    where: buildAttendanceRecordWhere(schoolId, filters),
    select: {
      student_id: true,
      scan_method: true,
      status: true
    }
  });

  return {
    totalRecords: logs.length,
    uniqueStudents: new Set(logs.map((log) => log.student_id.toString())).size,
    fingerprintCount: logs.filter((log) => normalizeMethod(log.scan_method) === "Fingerprint").length,
    faceCount: logs.filter((log) => normalizeMethod(log.scan_method) === "Face Recognition").length,
    cardCount: 0,
    passwordCount: 0,
    checkInCount: logs.filter((log) => log.status === AttendanceStatus.present || log.status === AttendanceStatus.late).length,
    checkOutCount: logs.filter((log) => log.status === AttendanceStatus.absent).length
  };
};

/* Legacy device log implementation replaced by attendance_logs-backed queries.
type GateLogFilters = {
  startDate?: string;
  endDate?: string;
  studentId?: string | number | bigint;
  deviceId?: string;
  method?: string;
  status?: AttendanceStatus;
  syncState?: string;
  search?: string;
};

type BiometricMethod = 'Fingerprint' | 'Password/PIN' | 'RFID Card' | 'Face Recognition' | 'Unknown';
type Direction = 'In' | 'Out' | 'Unknown';
type SyncState = 'Synced' | 'Queued' | 'Failed';

interface DeviceLog {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  method: BiometricMethod;
  methodRaw: string;
  direction: Direction;
  directionRaw: string;
  className?: string;
  section?: string;
  club?: string;
  deviceId: string;
  tabletId?: string;
  status: string;
  syncState: SyncState;
  sessionName?: string;
  statusLabel?: string;
  flagged: boolean;
  flagReason?: string;
  syncedAt?: string;
}

// Method mappings (scan_method field)
const METHOD_MAP: Record<string, BiometricMethod> = {
  'fingerprint': 'Fingerprint',
  '1': 'Fingerprint',
  'nfc': 'RFID Card',
  '2': 'Password/PIN',
  'manual': 'Password/PIN',
  'qr': 'RFID Card',
  '3': 'RFID Card',
  'face': 'Face Recognition',
  '20': 'Face Recognition'
};

// Direction mappings (event_type field)
const DIRECTION_MAP: Record<string, Direction> = {
  'entry': 'In',
  'exit': 'Out',
  '1': 'In',
  '2': 'Out',
  '3': 'In',
  '4': 'Out',
  '5': 'In',
  '6': 'Out',
  '7': 'In',
  '8': 'Out'
};

function normalizeMethod(raw: string): BiometricMethod {
  return METHOD_MAP[raw.toLowerCase()] ?? 'Unknown';
}

function normalizeDirection(raw: string): Direction {
  return DIRECTION_MAP[raw.toLowerCase()] ?? 'Unknown';
}

async function determineSyncState(
  schoolId: bigint,
  logId: bigint,
  syncedAt: Date | null
): Promise<SyncState> {
  if (syncedAt) return 'Synced';
  
  // Check offline_sync_queue for this log
  const queueEntry = await prisma.offline_sync_queue.findFirst({
    where: {
      school_id: schoolId,
      record_type: 'gate_log',
      // Assuming the gate log ID is stored in the payload
      payload: {
        path: ['id'],
        equals: logId.toString()
      }
    }
  });
  
  if (queueEntry) {
    if (queueEntry.status === 'failed') return 'Failed';
    if (queueEntry.status === 'pending' || queueEntry.status === 'processing') return 'Queued';
  }
  
  return 'Synced'; // default if not in queue
}

function enrichGateLog(
  log: gate_logs & {
    student: {
      id: bigint;
      first_name: string;
      last_name: string;
      student_section_enrollments: Array<{
        section: {
          name: string;
          class: {
            name: string;
          };
        };
      }>;
    } | null;
  },
  syncState: SyncState
): DeviceLog {
  const student = log.student;
  const enrollment = student?.student_section_enrollments?.[0];
  
  return {
    id: log.id.toString(),
    studentId: log.student_id?.toString() ?? '',
    studentName: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
    timestamp: log.scanned_at.toISOString(),
    method: normalizeMethod(log.scan_method),
    methodRaw: log.scan_method,
    direction: normalizeDirection(log.event_type),
    directionRaw: log.event_type,
    className: enrollment?.section.class.name,
    section: enrollment?.section.name,
    club: undefined, // Not available in current schema
    deviceId: log.device_id ?? '',
    tabletId: undefined, // Not directly available in gate_logs
    status: log.attendance_status ?? 'Present',
    syncState,
    sessionName: log.session_name ?? undefined,
    statusLabel: log.status_label ?? undefined,
    flagged: log.is_flagged,
    flagReason: log.flag_reason ?? undefined,
    syncedAt: log.synced_at?.toISOString()
  };
}

export const findGateLogsForSchool = async (
  schoolId: string | number | bigint,
  filters: GateLogFilters,
  pagination: { page: number; limit: number }
) => {
  const schoolIdBigInt = toBigInt(schoolId);
  
  // Build WHERE clause
  const where: Prisma.gate_logsWhereInput = {
    school_id: schoolIdBigInt
  };
  
  // Date range filters
  if (filters.startDate || filters.endDate) {
    where.scanned_at = {};
    if (filters.startDate) {
      where.scanned_at.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.scanned_at.lte = new Date(filters.endDate);
    }
  }
  
  // Student ID filter
  if (filters.studentId) {
    where.student_id = toBigInt(filters.studentId);
  }
  
  // Device ID filter
  if (filters.deviceId) {
    where.device_id = filters.deviceId;
  }
  
  // Status filter
  if (filters.status) {
    where.attendance_status = filters.status;
  }
  
  // Method filter - need to handle enum values
  if (filters.method) {
    const methodLower = filters.method.toLowerCase();
    // Map display names back to enum values
    const methodEnumMap: Record<string, ScanMethod> = {
      'fingerprint': ScanMethod.fingerprint,
      'password/pin': ScanMethod.manual,
      'rfid card': ScanMethod.nfc,
      'face recognition': ScanMethod.face
    };
    const enumValue = methodEnumMap[methodLower];
    if (enumValue) {
      where.scan_method = enumValue;
    }
  }
  
  // Search filter - by student name or ID
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    where.OR = [
      {
        student: {
          first_name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      },
      {
        student: {
          last_name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      },
      {
        student: {
          student_id_number: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      },
      {
        device_id: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      }
    ];
  }
  
  // Execute query with pagination
  const [logs, total] = await prisma.$transaction([
    prisma.gate_logs.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            student_section_enrollments: {
              where: {
                status: 'active'
              },
              take: 1,
              orderBy: {
                enrolled_at: 'desc'
              },
              select: {
                section: {
                  select: {
                    name: true,
                    class: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { scanned_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit
    }),
    prisma.gate_logs.count({ where })
  ]);
  
  // Enrich logs with sync state and normalized data
  const enrichedLogs: DeviceLog[] = [];
  for (const log of logs) {
    const syncState = await determineSyncState(schoolIdBigInt, log.id, log.synced_at);
    enrichedLogs.push(enrichGateLog(log, syncState));
  }
  
  // Apply sync state filter if specified (client-side filter since it's derived)
  let filteredLogs = enrichedLogs;
  if (filters.syncState) {
    filteredLogs = enrichedLogs.filter(log => log.syncState === filters.syncState);
  }
  
  return {
    data: filteredLogs,
    meta: {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    }
  };
};
*/
