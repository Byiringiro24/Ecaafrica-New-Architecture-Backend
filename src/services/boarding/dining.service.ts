/**
 * Dining Management Service
 * - Menus (daily/weekly/monthly/term)
 * - Schedules per dormitory/room/class
 * - Dining attendance marked by patron/matron
 * - Missing student exceptions (excluding students on approved leave)
 */
import { DiningMealType, DiningScheduleScope, DiningAttendanceStatus, LeaveState } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

const toBigInt = (v: string | number | bigint) =>
  typeof v === "bigint" ? v : BigInt(v);

// ── Menus ─────────────────────────────────────────────────────────────────────

export const createDiningMenu = async (
  schoolId: string | number | bigint,
  input: {
    name: string;
    menu_type?: "daily" | "weekly" | "monthly" | "term";
    start_date?: string;
    end_date?: string;
    created_by?: string | number | bigint;
  }
) => {
  const menu = await prisma.dining_menus.create({
    data: {
      school_id: toBigInt(schoolId),
      name: input.name,
      menu_type: input.menu_type ?? "weekly",
      start_date: input.start_date ? new Date(input.start_date) : undefined,
      end_date: input.end_date ? new Date(input.end_date) : undefined,
      created_by: input.created_by ? toBigInt(input.created_by) : undefined,
    },
  });
  return fmtMenu(menu);
};

export const listDiningMenus = async (schoolId: string | number | bigint) => {
  const menus = await prisma.dining_menus.findMany({
    where: { school_id: toBigInt(schoolId), is_active: true },
    include: { items: { orderBy: [{ day_of_week: "asc" }, { meal_type: "asc" }] } },
    orderBy: { created_at: "desc" },
  });
  return menus.map(fmtMenu);
};

export const addMenuItems = async (
  schoolId: string | number | bigint,
  menuId: string,
  items: Array<{ day_of_week: number; meal_type: DiningMealType; items: string; notes?: string }>
) => {
  const menu = await prisma.dining_menus.findFirst({
    where: { id: toBigInt(menuId), school_id: toBigInt(schoolId) },
  });
  if (!menu) throw new AppError("not_found", "Menu not found", 404);

  await prisma.dining_menu_items.createMany({
    data: items.map((i) => ({
      menu_id: menu.id,
      school_id: toBigInt(schoolId),
      day_of_week: i.day_of_week,
      meal_type: i.meal_type,
      items: i.items,
      notes: i.notes,
    })),
    skipDuplicates: true,
  });

  return prisma.dining_menu_items.findMany({ where: { menu_id: menu.id } });
};

// ── Schedules ─────────────────────────────────────────────────────────────────

export const createDiningSchedule = async (
  schoolId: string | number | bigint,
  input: {
    scope?: DiningScheduleScope;
    dormitory_id?: string | number | bigint;
    room_id?: string | number | bigint;
    class_id?: string | number | bigint;
    meal_type: DiningMealType;
    start_time: string; // "HH:MM"
    end_time: string;
    applicable_days?: string;
    created_by?: string | number | bigint;
  }
) => {
  const schedule = await prisma.dining_schedules.create({
    data: {
      school_id: toBigInt(schoolId),
      scope: input.scope ?? DiningScheduleScope.dormitory,
      dormitory_id: input.dormitory_id ? toBigInt(input.dormitory_id) : undefined,
      room_id: input.room_id ? toBigInt(input.room_id) : undefined,
      class_id: input.class_id ? toBigInt(input.class_id) : undefined,
      meal_type: input.meal_type,
      start_time: new Date(`1970-01-01T${input.start_time}:00`),
      end_time: new Date(`1970-01-01T${input.end_time}:00`),
      applicable_days: input.applicable_days ?? "mon,tue,wed,thu,fri,sat,sun",
      created_by: input.created_by ? toBigInt(input.created_by) : undefined,
    },
  });
  return fmtSchedule(schedule);
};

export const listDiningSchedules = async (
  schoolId: string | number | bigint,
  dormitoryId?: string | number | bigint
) => {
  const schedules = await prisma.dining_schedules.findMany({
    where: {
      school_id: toBigInt(schoolId),
      is_active: true,
      ...(dormitoryId ? { dormitory_id: toBigInt(dormitoryId) } : {}),
    },
    include: { dormitory: { select: { id: true, name: true } } },
    orderBy: [{ meal_type: "asc" }, { start_time: "asc" }],
  });
  return schedules.map(fmtSchedule);
};

// ── Sessions & Attendance ─────────────────────────────────────────────────────

export const openDiningSession = async (
  schoolId: string | number | bigint,
  dormitoryId: string | number | bigint,
  mealType: DiningMealType,
  sessionDate: Date,
  markedBy: string | number | bigint,
  scheduleId?: string | number | bigint,
  genderGroup?: string,
  classId?: string | number | bigint
) => {
  const existing = await prisma.dining_sessions.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      dormitory_id: dormitoryId ? toBigInt(dormitoryId) : null,
      class_id: classId ? toBigInt(classId) : null,
      meal_type: mealType,
      session_date: sessionDate,
      gender_group: genderGroup,
    },
  });
  if (existing) return fmtDiningSession(existing);

  const session = await prisma.dining_sessions.create({
    data: {
      school_id: toBigInt(schoolId),
      dormitory_id: dormitoryId ? toBigInt(dormitoryId) : null,
      meal_type: mealType,
      session_date: sessionDate,
      gender_group: genderGroup,
      opened_at: new Date(),
      marked_by: toBigInt(markedBy),
      schedule_id: scheduleId ? toBigInt(scheduleId) : undefined,
    },
  });
  return fmtDiningSession(session);
};

/** Get students expected for this dining session (excluding those on approved leave) */
export const getDiningSessionRoster = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint
) => {
  const session = await prisma.dining_sessions.findFirst({
    where: { id: toBigInt(sessionId), school_id: toBigInt(schoolId) },
  });
  if (!session) throw new AppError("not_found", "Dining session not found", 404);

  const assignments = await prisma.student_dorm_assignments.findMany({
    where: {
      school_id: toBigInt(schoolId),
      ...(session.dormitory_id ? { dormitory_id: session.dormitory_id } : {}),
      ...(session.class_id ? { student: { student_section_enrollments: { some: { left_at: null, section: { class_id: session.class_id } } } } } : {}),
      left_at: null,
    },
    include: {
      student: {
        select: {
          id: true, first_name: true, last_name: true, student_id_number: true,
          photo_url: true, boarding_status: true, gender: true,
          student_section_enrollments: {
            where: { status: "active" },
            orderBy: { enrolled_at: "desc" },
            take: 1,
            select: { section: { select: { full_name: true, name: true, class: { select: { name: true } } } } },
          },
        },
      },
    },
  });

  const filteredAssignments = session.gender_group
    ? assignments.filter((a: any) => (a.student.gender === "male" ? "boys" : a.student.gender === "female" ? "girls" : "other") === session.gender_group)
    : assignments;

  // Check who is on approved leave today
  const onLeaveIds = new Set<string>();
  for (const a of filteredAssignments) {
    const leave = await prisma.student_leave_requests.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        student_id: a.student_id,
        leave_state: { in: [LeaveState.outside_school, LeaveState.awaiting_physical_exit] },
        start_date: { lte: session.session_date },
        end_date: { gte: session.session_date },
      },
    });
    if (leave) onLeaveIds.add(a.student_id.toString());
  }

  // Get existing attendance marks for this session
  const marks = await prisma.dining_attendance.findMany({
    where: { session_id: session.id },
  });
  const markMap = new Map(marks.map((m) => [m.student_id.toString(), m.status]));

  return filteredAssignments.map((a) => {
    const studentId = a.student.id.toString();
    const isOnLeave = onLeaveIds.has(studentId);
    return {
      student: {
        id: studentId,
        first_name: a.student.first_name,
        last_name: a.student.last_name,
        full_name: `${a.student.first_name} ${a.student.last_name}`,
        student_id_number: a.student.student_id_number,
        photo_url: a.student.photo_url,
        boarding_status: a.student.boarding_status,
        class_name: a.student.student_section_enrollments[0]?.section?.full_name ?? a.student.student_section_enrollments[0]?.section?.class?.name ?? a.student.student_section_enrollments[0]?.section?.name ?? null,
      },
      is_on_leave: isOnLeave,
      attendance_status: isOnLeave
        ? DiningAttendanceStatus.on_leave
        : (markMap.get(studentId) ?? null),
    };
  });
};

/** Mark dining attendance for a batch of students */
export const markDiningAttendance = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint,
  marks: Array<{ student_id: string | number | bigint; status: DiningAttendanceStatus }>,
  markedBy: string | number | bigint
) => {
  const session = await prisma.dining_sessions.findFirst({
    where: { id: toBigInt(sessionId), school_id: toBigInt(schoolId) },
  });
  if (!session) throw new AppError("not_found", "Dining session not found", 404);

  const now = new Date();
  for (const mark of marks) {
    await prisma.dining_attendance.upsert({
      where: { session_id_student_id: { session_id: session.id, student_id: toBigInt(mark.student_id) } },
      create: {
        school_id: toBigInt(schoolId),
        session_id: session.id,
        student_id: toBigInt(mark.student_id),
        status: mark.status,
        marked_by: toBigInt(markedBy),
        marked_at: now,
      },
      update: { status: mark.status, marked_by: toBigInt(markedBy), marked_at: now },
    });
  }

  return { marked: marks.length, session_id: sessionId.toString() };
};

/** Close dining session and identify missing students */
export const closeDiningSession = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint,
  closedBy?: string | number | bigint,
) => {
  const session = await prisma.dining_sessions.findFirst({
    where: { id: toBigInt(sessionId), school_id: toBigInt(schoolId) },
  });
  if (!session) throw new AppError("not_found", "Dining session not found", 404);

  const roster = await getDiningSessionRoster(schoolId, sessionId);
  const missing = roster.filter(
    (r) => !r.is_on_leave && r.attendance_status !== DiningAttendanceStatus.present
  );

  await prisma.dining_sessions.update({
    where: { id: session.id },
    data: {
      closed_at: new Date(),
      ...(closedBy ? { marked_by: toBigInt(closedBy) } : {}),
    },
  });

  return {
    session_id: sessionId.toString(),
    closed_at: new Date().toISOString(),
    total_expected: roster.filter((r) => !r.is_on_leave).length,
    total_present: roster.filter((r) => r.attendance_status === DiningAttendanceStatus.present).length,
    total_on_leave: roster.filter((r) => r.is_on_leave).length,
    total_missing: missing.length,
    missing_students: missing.map((r) => r.student),
  };
};

/** List dining sessions with optional filters */
export const listDiningSessions = async (
  schoolId: string | number | bigint,
  filters?: {
    dormitory_id?: string;
    class_id?: string;
    meal_type?: DiningMealType;
    gender_group?: string;
    session_date?: string;
    limit?: number;
  }
) => {
  const sessions = await prisma.dining_sessions.findMany({
    where: {
      school_id: toBigInt(schoolId),
      ...(filters?.dormitory_id ? { dormitory_id: toBigInt(filters.dormitory_id) } : {}),
      ...(filters?.class_id ? { class_id: toBigInt(filters.class_id) } : {}),
      ...(filters?.meal_type ? { meal_type: filters.meal_type } : {}),
      ...(filters?.gender_group ? { gender_group: filters.gender_group } : {}),
      ...(filters?.session_date ? { session_date: new Date(filters.session_date) } : {}),
    },
    include: {
      dormitory: { select: { id: true, name: true, hostel_name: true } },
      marker: { select: { id: true, name: true } },
    },
    orderBy: [{ session_date: "desc" }, { opened_at: "desc" }],
    take: filters?.limit ?? 50,
  });
  return sessions.map(s => ({
    ...fmtDiningSession(s),
    dormitory: s.dormitory ? { id: s.dormitory.id.toString(), name: s.dormitory.name, hostel_name: (s.dormitory as any).hostel_name ?? null } : null,
  }));
};

/** Get a single dining session by ID */
export const getDiningSession = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint
) => {
  const session = await prisma.dining_sessions.findFirst({
    where: { id: toBigInt(sessionId), school_id: toBigInt(schoolId) },
    include: {
      dormitory: { select: { id: true, name: true, hostel_name: true } },
      marker: { select: { id: true, name: true } },
    },
  });
  if (!session) throw new AppError("not_found", "Dining session not found", 404);
  return {
    ...fmtDiningSession(session),
    dormitory: session.dormitory ? { id: session.dormitory.id.toString(), name: session.dormitory.name } : null,
  };
};

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtMenu = (m: any) => ({
  id: m.id.toString(),
  school_id: m.school_id.toString(),
  name: m.name,
  menu_type: m.menu_type,
  start_date: m.start_date?.toISOString().split("T")[0] ?? null,
  end_date: m.end_date?.toISOString().split("T")[0] ?? null,
  is_active: m.is_active,
  items: m.items ?? [],
  created_at: m.created_at.toISOString(),
});

const fmtTime = (t: Date | null) => {
  if (!t) return null;
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
};

const fmtSchedule = (s: any) => ({
  id: s.id.toString(),
  school_id: s.school_id.toString(),
  scope: s.scope,
  dormitory_id: s.dormitory_id?.toString() ?? null,
  marked_by: s.marked_by?.toString() ?? null,
  marked_by_user: s.marker ? { id: s.marker.id.toString(), name: s.marker.name } : null,
  dormitory: s.dormitory ? { ...s.dormitory, id: s.dormitory.id?.toString() } : undefined,
  meal_type: s.meal_type,
  start_time: fmtTime(s.start_time),
  end_time: fmtTime(s.end_time),
  applicable_days: s.applicable_days,
  is_active: s.is_active,
  created_at: s.created_at.toISOString(),
});

const fmtDiningSession = (s: any) => ({
  id: s.id.toString(),
  school_id: s.school_id.toString(),
  dormitory_id: s.dormitory_id?.toString() ?? null,
  class_id: s.class_id?.toString() ?? null,
  gender_group: s.gender_group ?? null,
  meal_type: s.meal_type,
  marked_by: s.marked_by?.toString() ?? null,
  marked_by_user: s.marker ? { id: s.marker.id.toString(), name: s.marker.name } : null,
  session_date: s.session_date instanceof Date ? s.session_date.toISOString().split("T")[0] : s.session_date,
  opened_at: s.opened_at?.toISOString() ?? null,
  closed_at: s.closed_at?.toISOString() ?? null,
  created_at: s.created_at.toISOString(),
});
