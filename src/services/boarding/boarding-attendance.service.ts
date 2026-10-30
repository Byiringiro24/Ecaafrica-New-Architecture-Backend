/**
 * Boarding Attendance Service
 * - Configurable windows per dormitory
 * - End-of-window reconciliation (identifies present/late/missing/on_leave)
 * - Escalation timer: after `escalation_mins` without attendance, sends parent SMS
 * - Manual correction with full audit
 */
import { BoardingAttendanceStatus, BoardingStatus, LeaveState } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { createNotification } from "../app.service";
import { sendSMS } from "../notification/sender.service";
import { sendAttendanceNotification } from "../attendance/notification.service";

const toBigInt = (v: string | number | bigint) =>
  typeof v === "bigint" ? v : BigInt(v);

// ── Windows ──────────────────────────────────────────────────────────────────

export const createAttendanceWindow = async (
  schoolId: string | number | bigint,
  input: {
    name: string;
    dormitory_id?: string | number | bigint;
    start_time: string; // "HH:MM"
    end_time: string;
    grace_minutes?: number;
    escalation_mins?: number;
    applicable_days?: string;
    created_by?: string | number | bigint;
  }
) => {
  const created = await prisma.boarding_attendance_windows.create({
    data: {
      school_id: toBigInt(schoolId),
      dormitory_id: input.dormitory_id ? toBigInt(input.dormitory_id) : undefined,
      name: input.name,
      start_time: new Date(`1970-01-01T${input.start_time}:00`),
      end_time: new Date(`1970-01-01T${input.end_time}:00`),
      grace_minutes: input.grace_minutes ?? 0,
      escalation_mins: input.escalation_mins ?? 60,
      applicable_days: input.applicable_days ?? "mon,tue,wed,thu,fri,sat,sun",
      created_by: input.created_by ? toBigInt(input.created_by) : undefined,
    },
  });
  return fmtWindow(created);
};

export const listAttendanceWindows = async (
  schoolId: string | number | bigint,
  dormitoryId?: string | number | bigint
) => {
  const rows = await prisma.boarding_attendance_windows.findMany({
    where: {
      school_id: toBigInt(schoolId),
      is_active: true,
      ...(dormitoryId ? { dormitory_id: toBigInt(dormitoryId) } : {}),
    },
    include: { dormitory: { select: { id: true, name: true } } },
    orderBy: { start_time: "asc" },
  });
  return rows.map(fmtWindow);
};

export const updateAttendanceWindow = async (
  schoolId: string | number | bigint,
  windowId: string,
  input: Partial<Parameters<typeof createAttendanceWindow>[1]>
) => {
  const w = await prisma.boarding_attendance_windows.findFirst({
    where: { id: toBigInt(windowId), school_id: toBigInt(schoolId) },
  });
  if (!w) throw new AppError("not_found", "Attendance window not found", 404);

  const updated = await prisma.boarding_attendance_windows.update({
    where: { id: w.id },
    data: {
      name: input.name,
      start_time: input.start_time ? new Date(`1970-01-01T${input.start_time}:00`) : undefined,
      end_time: input.end_time ? new Date(`1970-01-01T${input.end_time}:00`) : undefined,
      grace_minutes: input.grace_minutes,
      escalation_mins: input.escalation_mins,
      applicable_days: input.applicable_days,
    },
  });
  return fmtWindow(updated);
};

export const deleteAttendanceWindow = async (
  schoolId: string | number | bigint,
  windowId: string
) => {
  const w = await prisma.boarding_attendance_windows.findFirst({
    where: { id: toBigInt(windowId), school_id: toBigInt(schoolId) },
  });
  if (!w) throw new AppError("not_found", "Attendance window not found", 404);
  await prisma.boarding_attendance_windows.update({ where: { id: w.id }, data: { is_active: false } });
  return fmtWindow(w);
};

// ── Session & Reconciliation ──────────────────────────────────────────────────

/** List boarding attendance sessions with optional filters */
export const listBoardingSessions = async (
  schoolId: string | number | bigint,
  filters?: {
    dormitory_id?: string | number | bigint;
    location_type?: string;
    created_by?: string | number | bigint;
    session_date?: string; // YYYY-MM-DD
    limit?: number;
  }
) => {
  const sessions = await (prisma.boarding_attendance_sessions.findMany as any)({
    where: {
      school_id: toBigInt(schoolId),
      ...(filters?.dormitory_id ? { dormitory_id: toBigInt(filters.dormitory_id) } : {}),
      ...(filters?.location_type ? { location_type: filters.location_type } : {}),
      ...(filters?.created_by ? { created_by: toBigInt(filters.created_by) } : {}),
      ...(filters?.session_date ? { session_date: new Date(filters.session_date) } : {}),
    },
    include: {
      dormitory: { select: { id: true, name: true, block_name: true, hostel_name: true } },
    },
    orderBy: [{ session_date: "desc" }, { created_at: "desc" }],
    take: filters?.limit ?? 50,
  });
  return sessions.map((s: any) => ({
    ...fmtSession(s),
    dormitory: s.dormitory ? { ...s.dormitory, id: s.dormitory.id.toString() } : null,
  }));
};

/** Open a boarding attendance session for a dormitory on a given date */
export const openBoardingAttendanceSession = async (
  schoolId: string | number | bigint,
  dormitoryId: string | number | bigint,
  sessionDate: Date,
  windowId?: string | number | bigint,
  sessionName?: string,
  locationType?: string,
  createdBy?: string | number | bigint
) => {
  const existing = await (prisma.boarding_attendance_sessions.findFirst as any)({
    where: {
      school_id: toBigInt(schoolId),
      dormitory_id: toBigInt(dormitoryId),
      session_date: sessionDate,
      // If a session_name is provided, scope dedup to same name (allows multiple sessions per dorm per day)
      ...(sessionName ? { session_name: sessionName } : {}),
    },
  });
  if (existing) return fmtSession(existing);

  // Count expected boarders in this dorm (skip count for dining_hall sessions)
  const resolvedLocType = locationType ?? "dormitory";
  let expected = 0;
  if (resolvedLocType === "dormitory") {
    expected = await prisma.student_dorm_assignments.count({
      where: { school_id: toBigInt(schoolId), dormitory_id: toBigInt(dormitoryId), left_at: null },
    });
  }

  const session = await (prisma.boarding_attendance_sessions.create as any)({
    data: {
      school_id: toBigInt(schoolId),
      dormitory_id: toBigInt(dormitoryId),
      window_id: windowId ? toBigInt(windowId) : undefined,
      session_date: sessionDate,
      session_name: sessionName ?? null,
      location_type: resolvedLocType,
      created_by: createdBy ? toBigInt(createdBy) : undefined,
      total_expected: expected,
    },
  });

  // Pre-seed records as "missing" for dormitory sessions only
  if (resolvedLocType === "dormitory") {
    const assignments = await prisma.student_dorm_assignments.findMany({
      where: { school_id: toBigInt(schoolId), dormitory_id: toBigInt(dormitoryId), left_at: null },
      select: { student_id: true },
    });
    if (assignments.length > 0) {
      await prisma.boarding_attendance_records.createMany({
        data: assignments.map((a) => ({
          school_id: toBigInt(schoolId),
          session_id: session.id,
          student_id: a.student_id,
          dormitory_id: toBigInt(dormitoryId),
          status: BoardingAttendanceStatus.missing_attendance,
        })),
        skipDuplicates: true,
      });
    }
  }

  return fmtSession(session);
};

/**
 * Record a biometric scan for a student within a boarding session.
 * Called from tablet.service.ts when a scan arrives.
 */
export const recordBoardingAttendanceScan = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
  dormitoryId: string | number | bigint,
  scanTime: Date,
  biometricLogId?: string | number | bigint
) => {
  const sessionDate = new Date(scanTime.getFullYear(), scanTime.getMonth(), scanTime.getDate());

  // Resolve the window by time before finding the session. A dormitory has
  // separate morning and evening roll calls; using only dormitory/date here
  // silently merged both sessions and made the second scan overwrite the first.
  const windows = await prisma.boarding_attendance_windows.findMany({
    where: {
      school_id: toBigInt(schoolId),
      is_active: true,
      OR: [{ dormitory_id: toBigInt(dormitoryId) }, { dormitory_id: null }],
    },
    orderBy: [{ dormitory_id: { sort: "desc", nulls: "last" } }, { start_time: "asc" }],
  });

  const scanMinutes = scanTime.getHours() * 60 + scanTime.getMinutes();
  const window = windows.find((candidate) => {
    const start = candidate.start_time.getHours() * 60 + candidate.start_time.getMinutes();
    const end = candidate.end_time.getHours() * 60 + candidate.end_time.getMinutes();
    return start <= end ? scanMinutes >= start && scanMinutes <= end + candidate.grace_minutes : scanMinutes >= start || scanMinutes <= end + candidate.grace_minutes;
  }) ?? windows[0];
  const sessionName = window?.name ?? (scanTime.getHours() < 12 ? "Morning Roll Call" : "Evening Roll Call");

  // Find or open a session for this specific roll-call name.
  let session = await prisma.boarding_attendance_sessions.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      dormitory_id: toBigInt(dormitoryId),
      session_date: sessionDate,
      session_name: sessionName,
    },
  });
  if (!session) {
    session = (await openBoardingAttendanceSession(
      schoolId, dormitoryId, sessionDate, window?.id, sessionName
    )) as any;
  }

  let status: BoardingAttendanceStatus = BoardingAttendanceStatus.present;
  if (window) {
    const windowEndHour = window.end_time.getHours();
    const windowEndMin = window.end_time.getMinutes();
    const graceEndMs =
      new Date(sessionDate).setHours(windowEndHour, windowEndMin + window.grace_minutes, 0, 0);

    if (scanTime.getTime() > graceEndMs) {
      status = BoardingAttendanceStatus.late;
    }
  }

  // Upsert — keep the last valid scan
  const record = await prisma.boarding_attendance_records.upsert({
    where: { session_id_student_id: { session_id: session!.id, student_id: toBigInt(studentId) } },
    create: {
      school_id: toBigInt(schoolId),
      session_id: session!.id,
      student_id: toBigInt(studentId),
      dormitory_id: toBigInt(dormitoryId),
      status,
      scan_time: scanTime,
      biometric_log_id: biometricLogId ? toBigInt(biometricLogId) : undefined,
    },
    update: {
      status,
      scan_time: scanTime,
      biometric_log_id: biometricLogId ? toBigInt(biometricLogId) : undefined,
    },
  });

  return record;
};

/**
 * Reconcile session at end of window:
 * 1. Mark students with active leave as ON_APPROVED_LEAVE (exclude from missing)
 * 2. Everyone still missing → MISSING_ATTENDANCE
 * 3. Notify patron/matron and DOD
 * 4. Start escalation timer (parent gets notified after escalation_mins)
 */
export const reconcileBoardingAttendance = async (
  sessionId: string | number | bigint
) => {
  const session = await prisma.boarding_attendance_sessions.findUnique({
    where: { id: toBigInt(sessionId) },
    include: { window: true, dormitory: { select: { id: true, name: true, school_id: true } } },
  });
  if (!session) throw new AppError("not_found", "Session not found", 404);
  if (session.reconciled_at) return fmtSession(session);

  const records = await prisma.boarding_attendance_records.findMany({
    where: { session_id: session.id },
    include: { student: { select: { id: true, first_name: true, last_name: true } } },
  });

  const now = new Date();
  let totalPresent = 0, totalLate = 0, totalOnLeave = 0, totalMissing = 0;

  for (const rec of records) {
    if ((rec.status as string) === "present" || (rec.status as string) === "late") {
      if ((rec.status as string) === "present") totalPresent++;
      else totalLate++;
      continue;
    }

    // Check active approved leave
    const hasLeave = await prisma.student_leave_requests.findFirst({
      where: {
        school_id: session.school_id,
        student_id: rec.student_id,
        leave_state: { in: [LeaveState.outside_school, LeaveState.awaiting_physical_exit] },
        start_date: { lte: session.session_date },
        end_date: { gte: session.session_date },
      },
    });

    if (hasLeave) {
      await prisma.boarding_attendance_records.update({
        where: { id: rec.id },
        data: { status: BoardingAttendanceStatus.on_approved_leave },
      });
      totalOnLeave++;
    } else {
      await prisma.boarding_attendance_records.update({
        where: { id: rec.id },
        data: { status: BoardingAttendanceStatus.missing_attendance },
      });
      totalMissing++;
    }
  }

  // Update session summary
  const updated = await prisma.boarding_attendance_sessions.update({
    where: { id: session.id },
    data: {
      reconciled_at: now,
      total_present: totalPresent,
      total_late: totalLate,
      total_on_leave: totalOnLeave,
      total_missing: totalMissing,
      window_end: now,
    },
  });

  return fmtSession(updated);
};

/**
 * Run escalation: find missing records older than escalation_mins with no parent notification.
 * Send parent SMS/notification.
 */
export const runEscalation = async () => {
  const escalationCutoff = new Date(Date.now() - 60 * 60 * 1000); // default 1hr fallback

  const missingRecords = await prisma.boarding_attendance_records.findMany({
    where: {
      status: BoardingAttendanceStatus.missing_attendance,
      parent_notified_at: null,
      session: { reconciled_at: { not: null, lte: escalationCutoff } },
    },
    include: {
      student: {
        include: {
          student_parent_links: {
            where: { is_primary: true },
            include: { parent: { select: { id: true, phone: true, first_name: true } } },
            take: 1,
          },
        },
      },
      session: { include: { dormitory: { select: { id: true, name: true } } } },
    },
    take: 50,
  });

  for (const rec of missingRecords) {
    const parent = rec.student.student_parent_links[0]?.parent;
    if (!parent) continue;

    const studentName = `${rec.student.first_name} ${rec.student.last_name}`;
    const dormName = rec.session.dormitory?.name ?? "the dormitory";
    const sessionDate = rec.session.session_date ?? new Date();

    try {
      // Determine session type from session_name to pick morning vs evening template
      const sessionName = (rec.session as any).session_name ?? "";
      const isEvening = /evening|night|dinner|lights/i.test(sessionName);
      const kind = isEvening
        ? "dormitory_evening_absent"
        : "dormitory_morning_absent";

      // Use attendance_sms_mappings + notification_templates if available,
      // otherwise fall back to hardcoded message
      const notifResult = await sendAttendanceNotification({
        schoolId: rec.school_id,
        studentId: rec.student_id,
        kind,
        occurredAt: sessionDate,
        sourceType: "dormitory_manual",
        context: { dormitory_name: dormName },
      });

      if (!notifResult) {
        // Template system returned nothing (SMS disabled for this event) — use fallback
        const msg = `Your child ${studentName} has not recorded the required boarding attendance at ${dormName} today. Please contact the school if this is unexpected.`;
        await sendSMS(parent.phone, msg, undefined, rec.school_id, {
          recipientType: "parent", recipientId: parent.id, triggerType: "boarding_missing",
        });
      }

      await createNotification(parent.id, rec.school_id, {
        title: "Boarding Attendance Missing",
        body: `${studentName} was absent from boarding attendance at ${dormName}.`,
        type: "boarding_missing",
        studentId: rec.student_id,
      });
    } catch (_) { /* continue */ }

    await prisma.boarding_attendance_records.update({
      where: { id: rec.id },
      data: { parent_notified_at: new Date(), escalated_at: new Date() },
    });
  }
};

/** Manual correction with audit */
export const manuallyCorrectAttendance = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint,
  studentId: string | number | bigint,
  newStatus: BoardingAttendanceStatus,
  reason: string,
  correctedBy: string | number | bigint
) => {
  const rec = await prisma.boarding_attendance_records.findFirst({
    where: { session_id: toBigInt(sessionId), student_id: toBigInt(studentId), school_id: toBigInt(schoolId) },
  });
  if (!rec) throw new AppError("not_found", "Attendance record not found", 404);

  const updated = await prisma.boarding_attendance_records.update({
    where: { id: rec.id },
    data: {
      original_status: rec.original_status ?? rec.status,
      status: newStatus,
      is_manual: true,
      manual_reason: reason,
      corrected_by: toBigInt(correctedBy),
      corrected_at: new Date(),
    },
  });
  return updated;
};

/** Get session summary with per-student detail */
export const getBoardingAttendanceSummary = async (
  schoolId: string | number | bigint,
  sessionId: string | number | bigint
) => {
  const session = await prisma.boarding_attendance_sessions.findFirst({
    where: { id: toBigInt(sessionId), school_id: toBigInt(schoolId) },
    include: {
      dormitory: { select: { id: true, name: true, block_name: true } },
      records: {
        include: {
          student: {
            select: {
              id: true, first_name: true, last_name: true, student_id_number: true, photo_url: true, gender: true,
              student_section_enrollments: {
                where: { status: "active" },
                include: { section: { include: { class: { select: { name: true } } } } },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!session) throw new AppError("not_found", "Session not found", 404);

  return {
    ...fmtSession(session),
    records: session.records.map((r) => {
      const enrollment = r.student.student_section_enrollments[0];
      return {
        id: r.id.toString(),
        student: {
          id: r.student.id.toString(),
          first_name: r.student.first_name,
          last_name: r.student.last_name,
          full_name: `${r.student.first_name} ${r.student.last_name}`,
          student_id_number: r.student.student_id_number,
          photo_url: r.student.photo_url,
          gender: r.student.gender,
          class_name: enrollment?.section?.class?.name ?? null,
          section_name: enrollment?.section?.name ?? null,
        },
        status: r.status,
        scan_time: r.scan_time?.toISOString() ?? null,
        is_manual: r.is_manual,
        manual_reason: r.manual_reason,
        original_status: r.original_status,
        parent_notified_at: r.parent_notified_at?.toISOString() ?? null,
      };
    }),
  };
};

// ── Config ────────────────────────────────────────────────────────────────────

export const getBoardingConfig = async (schoolId: string | number | bigint) => {
  let config = await prisma.boarding_configurations.findUnique({
    where: { school_id: toBigInt(schoolId) },
  });
  if (!config) {
    config = await prisma.boarding_configurations.create({
      data: { school_id: toBigInt(schoolId) },
    });
  }
  return { ...config, school_id: config.school_id.toString() };
};

export const updateBoardingConfig = async (
  schoolId: string | number | bigint,
  data: Partial<Omit<Awaited<ReturnType<typeof getBoardingConfig>>, "id" | "school_id" | "created_at" | "updated_at">>
) => {
  const updated = await prisma.boarding_configurations.upsert({
    where: { school_id: toBigInt(schoolId) },
    create: { school_id: toBigInt(schoolId), ...data } as any,
    update: data as any,
  });
  return { ...updated, school_id: updated.school_id.toString() };
};

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtWindow = (w: any) => ({
  id: w.id.toString(),
  school_id: w.school_id.toString(),
  dormitory_id: w.dormitory_id?.toString() ?? null,
  dormitory: w.dormitory ? { ...w.dormitory, id: w.dormitory.id?.toString() } : undefined,
  name: w.name,
  start_time: w.start_time instanceof Date
    ? `${String(w.start_time.getHours()).padStart(2, "0")}:${String(w.start_time.getMinutes()).padStart(2, "0")}`
    : String(w.start_time),
  end_time: w.end_time instanceof Date
    ? `${String(w.end_time.getHours()).padStart(2, "0")}:${String(w.end_time.getMinutes()).padStart(2, "0")}`
    : String(w.end_time),
  grace_minutes: w.grace_minutes,
  escalation_mins: w.escalation_mins,
  is_active: w.is_active,
  applicable_days: w.applicable_days,
  created_at: w.created_at.toISOString(),
});

const fmtSession = (s: any) => ({
  id: s.id.toString(),
  school_id: s.school_id.toString(),
  dormitory_id: s.dormitory_id?.toString() ?? null,
  dormitory: s.dormitory ? { ...s.dormitory, id: s.dormitory.id?.toString() } : undefined,
  session_name: s.session_name ?? null,
  location_type: s.location_type ?? "dormitory",
  created_by: s.created_by?.toString() ?? null,
  session_date: s.session_date instanceof Date ? s.session_date.toISOString().split("T")[0] : s.session_date,
  reconciled_at: s.reconciled_at?.toISOString() ?? null,
  total_expected: s.total_expected,
  total_present: s.total_present,
  total_late: s.total_late,
  total_on_leave: s.total_on_leave,
  total_missing: s.total_missing,
  created_at: s.created_at.toISOString(),
});
