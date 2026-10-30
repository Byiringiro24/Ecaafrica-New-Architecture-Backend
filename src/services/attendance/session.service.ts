import type { Prisma, attendance_sessions } from "@prisma/client";
import { AttendanceSessionType } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { utcDayRange } from "../../utils/date-range";

type AttendanceSessionCreateInput = {
  section_id: string | number | bigint;
  subject_id?: string | number | bigint;
  teacher_id?: string | number | bigint;
  period_id?: string | number | bigint;
  session_date: string | Date;
  session_type?: AttendanceSessionType;
  started_at?: string | Date;
  notes?: string;
};

type AttendanceSessionUpdateInput = Partial<AttendanceSessionCreateInput>;

type AttendanceSessionFilters = {
  section_id?: string | number | bigint;
  class_id?: string | number | bigint;
  session_type?: AttendanceSessionType;
  period_id?: string | number | bigint;
  subject_id?: string | number | bigint;
  teacher_id?: string | number | bigint;
  date?: string;
};

type AttendanceSessionWithDetails = attendance_sessions & {
  subject?: { id: bigint; name: string; code: string | null } | null;
  teacher?: { id: bigint; name: string } | null;
  period?: { id: bigint; name: string } | null;
  section?: { id: bigint; name: string; full_name: string; class: { name: string } } | null;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const formatSession = (record: AttendanceSessionWithDetails) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  section_id: record.section_id.toString(),
  subject_id: record.subject_id ? record.subject_id.toString() : null,
  teacher_id: record.teacher_id ? record.teacher_id.toString() : null,
  period_id: record.period_id ? record.period_id.toString() : null,
  subject: record.subject
    ? {
        id: record.subject.id.toString(),
        name: record.subject.name,
        code: record.subject.code
      }
    : null,
  teacher: record.teacher
    ? { id: record.teacher.id.toString(), name: record.teacher.name }
    : null,
  period: record.period
    ? { id: record.period.id.toString(), name: record.period.name }
    : null,
  section: record.section
    ? {
        id: record.section.id.toString(),
        name: record.section.name,
        full_name: record.section.full_name,
        class: record.section.class
      }
    : null
});

const sessionDetailsInclude = {
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, name: true } },
  period: { select: { id: true, name: true } },
  section: { select: { id: true, name: true, full_name: true, class: { select: { name: true } } } }
} as const;

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "session_date", "started_at", "submitted_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.attendance_sessionsOrderByWithRelationInput;
  }

  return { session_date: "desc" } as Prisma.attendance_sessionsOrderByWithRelationInput;
};

export const createSession = async (
  schoolId: string | number | bigint,
  input: AttendanceSessionCreateInput
) => {
  const schoolBigInt  = toBigInt(schoolId);
  const sectionBigInt = toBigInt(input.section_id);
  const subjectBigInt = input.subject_id ? toBigInt(input.subject_id) : null;
  const teacherBigInt = input.teacher_id ? toBigInt(input.teacher_id) : null;
  const periodBigInt  = input.period_id  ? toBigInt(input.period_id)  : null;
  const sessionDate   = toDateValue(input.session_date);
  const sessionType   = input.session_type ?? AttendanceSessionType.class;
  const startedAt     = input.started_at ? toDateValue(input.started_at) : new Date();

  // Use a raw INSERT … ON CONFLICT DO NOTHING so two concurrent requests for
  // the exact same session (same teacher, class, period, subject, date) are
  // handled entirely by the database unique index — no advisory lock, no
  // serialisation, no P2002 errors ever reaching the application layer.
  //
  // The unique index (attendance_sessions_natural_key) was created by migration
  // 20261010000000 and uses COALESCE(x, 0) so NULL values compare as equal.
  //
  // Race outcome:
  //   Request A  →  INSERT succeeds, returns the new row id.
  //   Request B  →  INSERT is skipped (ON CONFLICT DO NOTHING), returns nothing.
  //   Both then  →  SELECT the row by its natural key — both get the same row.
  //
  // This is fully concurrent. No lock anywhere. Multiple teachers in different
  // classes create their sessions in parallel without ever touching each other.

  await prisma.$executeRaw`
    INSERT INTO attendance_sessions
      (school_id, section_id, subject_id, teacher_id, period_id,
       session_date, session_type, started_at, created_at)
    VALUES
      (${schoolBigInt}, ${sectionBigInt}, ${subjectBigInt}, ${teacherBigInt}, ${periodBigInt},
       ${sessionDate}, ${sessionType}::"AttendanceSessionType", ${startedAt}, NOW())
    ON CONFLICT DO NOTHING
  `;

  // Whether the INSERT won or lost the race, the row now exists.
  // Fetch it by the natural key so both concurrent callers get the same id.
  const session = await prisma.attendance_sessions.findFirst({
    where: {
      school_id:    schoolBigInt,
      section_id:   sectionBigInt,
      session_date: sessionDate,
      session_type: sessionType,
      period_id:    periodBigInt,
      subject_id:   subjectBigInt,
      teacher_id:   teacherBigInt,
    },
    include: sessionDetailsInclude,
    orderBy: { id: "asc" },   // stable ordering — lowest id = first created
  });

  if (!session) {
    // Should never happen — if INSERT was skipped the row must already exist.
    throw new AppError("internal_error", "Failed to create or find attendance session", 500);
  }

  return formatSession(session);
};

export const closeSession = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid attendance session id", 400);
  }

  const existing = await prisma.attendance_sessions.findFirst({
    where: { id: toBigInt(id), school_id: toBigInt(schoolId) },
    include: sessionDetailsInclude
  });

  if (!existing) {
    throw new AppError("not_found", "Attendance session not found", 404);
  }

  // Closing is idempotent — if already submitted, return as-is.
  // This allows the teacher to call close multiple times safely
  // (e.g. double-tap on "Submit Attendance" button).
  if (existing.submitted_at) {
    return formatSession(existing as AttendanceSessionWithDetails);
  }

  const updated = await prisma.attendance_sessions.update({
    where: { id: existing.id },
    data: { submitted_at: new Date() },
    include: sessionDetailsInclude
  });

  return formatSession(updated);
};

export const listSessionsBySchoolAndDate = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: AttendanceSessionFilters = {}
) => {
  const { page, limit, sort, order } = pagination;

  const where: Prisma.attendance_sessionsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.section_id) where.section_id = toBigInt(filters.section_id);
  if (filters.class_id) {
    where.section = {
      class_id: toBigInt(filters.class_id)
    };
  }
  if (filters.session_type) where.session_type = filters.session_type;
  if (filters.period_id) where.period_id = toBigInt(filters.period_id);
  if (filters.subject_id) where.subject_id = toBigInt(filters.subject_id);
  if (filters.teacher_id) where.teacher_id = toBigInt(filters.teacher_id);
  if (filters.date) {
    const { start, end } = utcDayRange(filters.date);
    where.session_date = {
      gte: start,
      lt: end
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.attendance_sessions.findMany({
      where,
      include: sessionDetailsInclude,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.attendance_sessions.count({ where })
  ]);

  return {
    data: items.map((item) => formatSession(item)),
    meta: { page, limit, total }
  };
};

export const findSessionById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid attendance session id", 400);
  }

  const session = await prisma.attendance_sessions.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: sessionDetailsInclude
  });

  if (!session) {
    throw new AppError("not_found", "Attendance session not found", 404);
  }

  return formatSession(session);
};

export const updateSession = async (
  schoolId: string | number | bigint,
  id: string,
  input: AttendanceSessionUpdateInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid attendance session id", 400);
  }

  const existing = await prisma.attendance_sessions.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Attendance session not found", 404);
  }

  const data: Prisma.attendance_sessionsUpdateInput = {} as Prisma.attendance_sessionsUpdateInput;
  if (input.section_id !== undefined) {
    (data as any).section = { connect: { id: toBigInt(input.section_id) } };
  }
  if (input.subject_id !== undefined) {
    (data as any).subject = input.subject_id
      ? { connect: { id: toBigInt(input.subject_id) } }
      : { disconnect: true };
  }
  if (input.teacher_id !== undefined) {
    (data as any).teacher = input.teacher_id
      ? { connect: { id: toBigInt(input.teacher_id) } }
      : { disconnect: true };
  }
  if (input.period_id !== undefined) {
    (data as any).period = input.period_id
      ? { connect: { id: toBigInt(input.period_id) } }
      : { disconnect: true };
  }
  if (input.session_date !== undefined) data.session_date = toDateValue(input.session_date);
  if (input.session_type !== undefined) data.session_type = input.session_type;
  if (input.started_at !== undefined) {
    data.started_at = input.started_at ? toDateValue(input.started_at) : null;
  }
  if (input.notes !== undefined) data.notes = input.notes;

  const updated = await prisma.attendance_sessions.update({
    where: { id: existing.id },
    data,
    include: sessionDetailsInclude
  });

  return formatSession(updated);
};

export const deleteSession = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid attendance session id", 400);
  }

  const existing = await prisma.attendance_sessions.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Attendance session not found", 404);
  }

  await prisma.attendance_sessions.delete({
    where: { id: existing.id }
  });

  return formatSession(existing);
};
