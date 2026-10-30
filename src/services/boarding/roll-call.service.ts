import type {
  BoardingRollStatus,
  BoardingSessionType,
  Prisma,
  boarding_roll_call_records,
  boarding_roll_calls,
} from "@prisma/client";
import { StudentType } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { emitRollCallUpdate } from "../../sockets/notification.socket";
import { sendAttendanceNotification } from "../attendance/notification.service";
import { fireAndLog } from "../../utils/async";

type RollCallCreateInput = {
  dormitory_id: string | number | bigint;
  roll_date?: string | Date;
  session_type: BoardingSessionType;
  conducted_by?: string | number | bigint;
  notes?: string;
};

type RollCallUpdateInput = {
  dormitory_id?: string | number | bigint;
  roll_date?: string | Date;
  session_type?: BoardingSessionType;
  conducted_by?: string | number | bigint | null;
  submitted_at?: string | Date | null;
  notes?: string | null;
};

type RollCallFilters = {
  dormitory_id?: string | number | bigint;
  roll_date?: string;
  session_type?: BoardingSessionType;
  dormitory_ids?: bigint[];
};

type RollCallRecordInput = {
  student_id: string | number | bigint;
  status: BoardingRollStatus;
  notes?: string;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const formatRollCall = (record: boarding_roll_calls) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  dormitory_id: record.dormitory_id.toString(),
  conducted_by: record.conducted_by ? record.conducted_by.toString() : null,
});

const formatRecord = (record: boarding_roll_call_records) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  roll_call_id: record.roll_call_id.toString(),
  student_id: record.student_id.toString(),
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "roll_date", "submitted_at"]);
  if (sort && allowed.has(sort)) {
    return {
      [sort]: order ?? "desc",
    } as Prisma.boarding_roll_callsOrderByWithRelationInput;
  }

  return {
    roll_date: "desc",
  } as Prisma.boarding_roll_callsOrderByWithRelationInput;
};

const assertDormitory = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  dormitoryId: string | number | bigint,
) => {
  const dormitory = await tx.dormitories.findFirst({
    where: {
      id: toBigInt(dormitoryId),
      school_id: toBigInt(schoolId),
    },
  });

  if (!dormitory) {
    throw new AppError("not_found", "Dormitory not found", 404);
  }

  return dormitory;
};

const assertStaffProfile = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  staffId: string | number | bigint,
) => {
  const staff = await tx.staff_profiles.findFirst({
    where: {
      id: toBigInt(staffId),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
  });

  if (!staff) {
    throw new AppError("not_found", "Staff profile not found", 404);
  }

  return staff;
};

const assertRollCall = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  rollCallId: string,
) => {
  if (!/^\d+$/.test(rollCallId)) {
    throw new AppError("bad_request", "Invalid roll call id", 400);
  }

  const record = await tx.boarding_roll_calls.findFirst({
    where: {
      id: toBigInt(rollCallId),
      school_id: toBigInt(schoolId),
    },
  });

  if (!record) {
    throw new AppError("not_found", "Roll call not found", 404);
  }

  return record;
};

const assertStudentBoarding = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
) => {
  const student = await tx.students.findFirst({
    where: {
      id: toBigInt(studentId),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  if (student.student_type !== StudentType.boarding) {
    throw new AppError("bad_request", "Student is not a boarding student", 400);
  }

  return student;
};

const assertAssignedToDorm = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  dormitoryId: string | number | bigint,
  studentId: string | number | bigint,
) => {
  const assignment = await tx.student_dorm_assignments.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      dormitory_id: toBigInt(dormitoryId),
      student_id: toBigInt(studentId),
      left_at: null,
    },
  });

  if (!assignment) {
    throw new AppError(
      "bad_request",
      "Student is not assigned to this dormitory",
      400,
    );
  }

  return assignment;
};

export const createRollCall = async (
  schoolId: string | number | bigint,
  dormitoryId: string | number | bigint,
  sessionType: BoardingSessionType,
  input: Omit<RollCallCreateInput, "dormitory_id" | "session_type"> = {},
) =>
  prisma.$transaction(async (tx) => {
    await assertDormitory(tx, schoolId, dormitoryId);

    if (input.conducted_by) {
      await assertStaffProfile(tx, schoolId, input.conducted_by);
    }

    const rollDate = input.roll_date
      ? toDateValue(input.roll_date)
      : new Date();

    const duplicate = await tx.boarding_roll_calls.findFirst({
      where: {
        dormitory_id: toBigInt(dormitoryId),
        roll_date: rollDate,
        session_type: sessionType,
      },
    });

    if (duplicate) {
      throw new AppError("conflict", "Roll call already exists", 409);
    }

    const created = await tx.boarding_roll_calls.create({
      data: {
        school_id: toBigInt(schoolId),
        dormitory_id: toBigInt(dormitoryId),
        roll_date: rollDate,
        session_type: sessionType,
        conducted_by: input.conducted_by
          ? toBigInt(input.conducted_by)
          : undefined,
        notes: input.notes,
      },
    });

    return formatRollCall(created);
  });

export const listRollCalls = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: RollCallFilters = {},
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.boarding_roll_callsWhereInput = {
    school_id: toBigInt(schoolId),
  };

  if (filters.dormitory_id) where.dormitory_id = toBigInt(filters.dormitory_id);
  if (filters.dormitory_ids) where.dormitory_id = { in: filters.dormitory_ids };
  if (filters.session_type) where.session_type = filters.session_type;
  if (filters.roll_date) {
    const start = new Date(filters.roll_date);
    const end = new Date(filters.roll_date);
    end.setDate(end.getDate() + 1);
    where.roll_date = { gte: start, lt: end };
  }

  const [items, total] = await prisma.$transaction([
    prisma.boarding_roll_calls.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.boarding_roll_calls.count({ where }),
  ]);

  return {
    data: items.map((item) => formatRollCall(item)),
    meta: { page, limit, total },
  };
};

export const findRollCallById = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid roll call id", 400);
  }

  const record = await prisma.boarding_roll_calls.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!record) {
    throw new AppError("not_found", "Roll call not found", 404);
  }

  return formatRollCall(record);
};

export const updateRollCall = async (
  schoolId: string | number | bigint,
  id: string,
  input: RollCallUpdateInput,
) =>
  prisma.$transaction(async (tx) => {
    const existing = await assertRollCall(tx, schoolId, id);

    const dormitoryId = input.dormitory_id ?? existing.dormitory_id;
    const rollDate = input.roll_date
      ? toDateValue(input.roll_date)
      : existing.roll_date;
    const sessionType = input.session_type ?? existing.session_type;

    if (input.dormitory_id) {
      await assertDormitory(tx, schoolId, input.dormitory_id);
    }

    if (input.conducted_by) {
      await assertStaffProfile(tx, schoolId, input.conducted_by);
    }

    if (input.dormitory_id || input.roll_date || input.session_type) {
      const duplicate = await tx.boarding_roll_calls.findFirst({
        where: {
          dormitory_id: toBigInt(dormitoryId),
          roll_date: rollDate,
          session_type: sessionType,
          NOT: { id: existing.id },
        },
      });

      if (duplicate) {
        throw new AppError("conflict", "Roll call already exists", 409);
      }
    }

    const updated = await tx.boarding_roll_calls.update({
      where: { id: existing.id },
      data: {
        dormitory_id: input.dormitory_id
          ? toBigInt(input.dormitory_id)
          : undefined,
        roll_date: input.roll_date ? rollDate : undefined,
        session_type: input.session_type,
        conducted_by:
          input.conducted_by === undefined
            ? undefined
            : input.conducted_by
              ? toBigInt(input.conducted_by)
              : null,
        submitted_at:
          input.submitted_at === undefined
            ? undefined
            : input.submitted_at
              ? toDateValue(input.submitted_at)
              : null,
        notes: input.notes === undefined ? undefined : input.notes,
      },
    });

    return formatRollCall(updated);
  });

export const deleteRollCall = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid roll call id", 400);
  }

  const existing = await prisma.boarding_roll_calls.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!existing) {
    throw new AppError("not_found", "Roll call not found", 404);
  }

  await prisma.boarding_roll_calls.delete({ where: { id: existing.id } });
  return formatRollCall(existing);
};

export const submitRollCallRecord = async (
  schoolId: string | number | bigint,
  rollCallId: string,
  input: RollCallRecordInput,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const rollCall = await assertRollCall(tx, schoolId, rollCallId);
    await assertStudentBoarding(tx, schoolId, input.student_id);
    await assertAssignedToDorm(
      tx,
      schoolId,
      rollCall.dormitory_id,
      input.student_id,
    );

    const record = await tx.boarding_roll_call_records.upsert({
      where: {
        roll_call_id_student_id: {
          roll_call_id: rollCall.id,
          student_id: toBigInt(input.student_id),
        },
      },
      update: {
        status: input.status,
        notes: input.notes,
      },
      create: {
        school_id: toBigInt(schoolId),
        roll_call_id: rollCall.id,
        student_id: toBigInt(input.student_id),
        status: input.status,
        notes: input.notes,
      },
    });

    const formatted = formatRecord(record);
    emitRollCallUpdate(formatted.school_id, formatted);

    return {
      formatted,
      session_type: rollCall.session_type,
      roll_date: rollCall.roll_date,
    };
  });

  fireAndLog(
    sendAttendanceNotification({
      schoolId,
      studentId: input.student_id,
      kind:
        result.session_type === "morning"
          ? input.status === "absent"
            ? "dormitory_morning_absent"
            : input.status === "on_leave"
              ? "dormitory_morning_on_leave"
              : "dormitory_morning_present"
          : input.status === "absent"
            ? "dormitory_evening_absent"
            : input.status === "on_leave"
              ? "dormitory_evening_on_leave"
              : "dormitory_evening_present",
      occurredAt: result.roll_date,
      sourceType: "dormitory_manual",
      context: { attendance_status: input.status, status: input.status },
    }),
    "roll-call.submitRollCall.notify"
  );

  return result.formatted;
};

export const bulkSubmitRollCall = async (
  schoolId: string | number | bigint,
  rollCallId: string,
  records: RollCallRecordInput[],
) => {
  const result = await prisma.$transaction(async (tx) => {
    const rollCall = await assertRollCall(tx, schoolId, rollCallId);
    const studentIds = records.map((record) => toBigInt(record.student_id));

    const students = await tx.students.findMany({
      where: {
        id: { in: studentIds },
        school_id: toBigInt(schoolId),
        deleted_at: null,
      },
    });

    if (students.length !== studentIds.length) {
      throw new AppError("not_found", "One or more students not found", 404);
    }

    const nonBoarding = students.find(
      (student) => student.student_type !== StudentType.boarding,
    );
    if (nonBoarding) {
      throw new AppError(
        "bad_request",
        "One or more students are not boarding",
        400,
      );
    }

    const assignments = await tx.student_dorm_assignments.findMany({
      where: {
        school_id: toBigInt(schoolId),
        dormitory_id: rollCall.dormitory_id,
        student_id: { in: studentIds },
        left_at: null,
      },
    });

    if (assignments.length !== studentIds.length) {
      throw new AppError(
        "bad_request",
        "One or more students are not assigned to this dormitory",
        400,
      );
    }

    const results = await Promise.all(
      records.map((record) =>
        tx.boarding_roll_call_records.upsert({
          where: {
            roll_call_id_student_id: {
              roll_call_id: rollCall.id,
              student_id: toBigInt(record.student_id),
            },
          },
          update: {
            status: record.status,
            notes: record.notes,
          },
          create: {
            school_id: toBigInt(schoolId),
            roll_call_id: rollCall.id,
            student_id: toBigInt(record.student_id),
            status: record.status,
            notes: record.notes,
          },
        }),
      ),
    );

    const formatted = results.map((item) => formatRecord(item));
    emitRollCallUpdate(rollCall.school_id, {
      roll_call_id: rollCall.id.toString(),
      records: formatted,
    });

    return {
      formatted,
      session_type: rollCall.session_type,
      roll_date: rollCall.roll_date,
    };
  });

  for (const record of records) {
    fireAndLog(
      sendAttendanceNotification({
        schoolId,
        studentId: record.student_id,
        kind:
          result.session_type === "morning"
            ? record.status === "absent"
              ? "dormitory_morning_absent"
              : record.status === "on_leave"
                ? "dormitory_morning_on_leave"
                : "dormitory_morning_present"
            : record.status === "absent"
              ? "dormitory_evening_absent"
              : record.status === "on_leave"
                ? "dormitory_evening_on_leave"
                : "dormitory_evening_present",
        occurredAt: result.roll_date,
        sourceType: "dormitory_manual",
        context: { attendance_status: record.status, status: record.status },
      }),
      "roll-call.bulkSubmit.notify"
    );
  }

  return result.formatted;
};

export const getRollCallSummary = async (
  schoolId: string | number | bigint,
  rollCallId: string,
) => {
  if (!/^\d+$/.test(rollCallId)) {
    throw new AppError("bad_request", "Invalid roll call id", 400);
  }

  const rollCall = await prisma.boarding_roll_calls.findFirst({
    where: {
      id: toBigInt(rollCallId),
      school_id: toBigInt(schoolId),
    },
  });

  if (!rollCall) {
    throw new AppError("not_found", "Roll call not found", 404);
  }

  const grouped = await prisma.boarding_roll_call_records.groupBy({
    by: ["status"],
    where: {
      roll_call_id: toBigInt(rollCallId),
      school_id: toBigInt(schoolId),
    },
    _count: { _all: true },
  });

  const summary = {
    roll_call_id: rollCallId,
    total: 0,
    present: 0,
    absent: 0,
    on_leave: 0,
  };

  for (const row of grouped) {
    summary.total += row._count._all;
    if (row.status === "present") summary.present = row._count._all;
    if (row.status === "absent") summary.absent = row._count._all;
    if (row.status === "on_leave") summary.on_leave = row._count._all;
  }

  return summary;
};

/**
 * Return the dormitory roster for a roll call.  This deliberately reads from
 * the boarding tables (and not attendance_records), so boarding attendance
 * can never be confused with classroom attendance.
 */
export const getRollCallRoster = async (
  schoolId: string | number | bigint,
  rollCallId: string,
) => {
  if (!/^\d+$/.test(rollCallId)) {
    throw new AppError("bad_request", "Invalid roll call id", 400);
  }

  const rollCall = await prisma.boarding_roll_calls.findFirst({
    where: { id: toBigInt(rollCallId), school_id: toBigInt(schoolId) },
    include: {
      dormitory: { select: { id: true, name: true, gender: true } },
      boarding_roll_call_records: true,
    },
  });

  if (!rollCall) throw new AppError("not_found", "Roll call not found", 404);

  const assignments = await prisma.student_dorm_assignments.findMany({
    where: {
      school_id: toBigInt(schoolId),
      dormitory_id: rollCall.dormitory_id,
      left_at: null,
    },
    include: {
      student: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          student_id_number: true,
          gender: true,
        },
      },
      room: { select: { id: true, room_number: true } },
    },
    orderBy: { student: { last_name: "asc" } },
  });

  const records = new Map(
    rollCall.boarding_roll_call_records.map((record) => [
      record.student_id.toString(),
      record,
    ]),
  );

  return {
    roll_call: formatRollCall(rollCall),
    dormitory: {
      id: rollCall.dormitory.id.toString(),
      name: rollCall.dormitory.name,
      gender: rollCall.dormitory.gender,
    },
    students: assignments.map((assignment) => {
      const record = records.get(assignment.student_id.toString());
      return {
        id: assignment.student.id.toString(),
        first_name: assignment.student.first_name,
        last_name: assignment.student.last_name,
        student_id_number: assignment.student.student_id_number,
        gender: assignment.student.gender,
        room: assignment.room
          ? {
              id: assignment.room.id.toString(),
              room_number: assignment.room.room_number,
            }
          : null,
        record: record
          ? {
              id: record.id.toString(),
              status: record.status,
              notes: record.notes,
              created_at: record.created_at,
            }
          : null,
      };
    }),
  };
};
