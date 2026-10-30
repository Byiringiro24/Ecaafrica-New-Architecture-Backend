import type { Prisma, gate_logs } from "@prisma/client";
import { GateEventType, ScanMethod } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { emitGateEvent } from "../../sockets/notification.socket";
import { sendAttendanceNotification } from "../attendance/notification.service";
import { fireAndLog } from "../../utils/async";

type GateLogFilters = {
  student_id?: string | number | bigint;
  event_type?: GateEventType;
  scan_method?: ScanMethod;
  device_id?: string;
  is_flagged?: boolean;
  date?: string;
};

type GateLogUpdateInput = {
  student_id?: string | number | bigint;
  event_type?: GateEventType;
  scan_method?: ScanMethod;
  device_id?: string;
  is_flagged?: boolean;
  flag_reason?: string;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatLog = (record: gate_logs) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id ? record.student_id.toString() : null,
  visitor_id: record.visitor_id ? record.visitor_id.toString() : null,
  user_id: record.user_id ? record.user_id.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "scanned_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.gate_logsOrderByWithRelationInput;
  }
  return { scanned_at: "desc" } as Prisma.gate_logsOrderByWithRelationInput;
};

export const logEvent = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint | undefined,
  eventType: GateEventType,
  scanMethod: ScanMethod,
  deviceId?: string
) => {
  if (studentId) {
    const student = await prisma.students.findFirst({
      where: {
        id: toBigInt(studentId),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!student) {
      throw new AppError("not_found", "Student not found", 404);
    }
  }

  const created = await prisma.gate_logs.create({
    data: {
      school_id: toBigInt(schoolId),
      student_id: studentId ? toBigInt(studentId) : undefined,
      event_type: eventType,
      scan_method: scanMethod,
      device_id: deviceId
    }
  });

  if (created.student_id && (created.event_type === GateEventType.entry || created.event_type === GateEventType.exit)) {
    fireAndLog(
      sendAttendanceNotification({
        schoolId,
        studentId: created.student_id,
        kind: created.event_type === GateEventType.exit ? "school_exit" : "school_entry",
        occurredAt: created.scanned_at,
        sourceType: "gate_device",
        scopeKey: created.device_id ?? "global"
      }),
      "gate.log.createLog.notify"
    );
  }

  const formatted = formatLog(created);
  emitGateEvent(formatted.school_id, formatted);

  return formatted;
};

export const getLogs = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: GateLogFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.gate_logsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.event_type) where.event_type = filters.event_type;
  if (filters.scan_method) where.scan_method = filters.scan_method;
  if (filters.device_id) where.device_id = filters.device_id;
  if (filters.is_flagged !== undefined) where.is_flagged = filters.is_flagged;
  if (filters.date) {
    const start = new Date(filters.date);
    const end = new Date(filters.date);
    end.setDate(end.getDate() + 1);
    where.scanned_at = { gte: start, lt: end };
  }

  const [items, total] = await prisma.$transaction([
    prisma.gate_logs.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.gate_logs.count({ where })
  ]);

  return {
    data: items.map((item) => formatLog(item)),
    meta: { page, limit, total }
  };
};

export const getActiveStudentsOnCampus = async (schoolId: string | number | bigint) => {
  const recentLogs = await prisma.gate_logs.findMany({
    where: {
      school_id: toBigInt(schoolId),
      student_id: {
        not: null
      }
    },
    orderBy: { scanned_at: "desc" },
    select: {
      student_id: true,
      event_type: true,
      scanned_at: true
    }
  });

  const latestByStudent = new Map<string, { event_type: GateEventType; scanned_at: Date }>();

  for (const log of recentLogs) {
    if (!log.student_id) continue;
    const key = log.student_id.toString();
    if (!latestByStudent.has(key)) {
      latestByStudent.set(key, {
        event_type: log.event_type,
        scanned_at: log.scanned_at
      });
    }
  }

  const activeStudentIds = Array.from(latestByStudent.entries())
    .filter(([, value]) => value.event_type === GateEventType.entry)
    .map(([studentId]) => BigInt(studentId));

  if (!activeStudentIds.length) return [];

  const students = await prisma.students.findMany({
    where: {
      school_id: toBigInt(schoolId),
      id: { in: activeStudentIds },
      deleted_at: null
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      student_id_number: true
    }
  });

  return students.map((student) => ({
    id: student.id.toString(),
    first_name: student.first_name,
    last_name: student.last_name,
    admission_no: student.student_id_number
  }));
};

export const findGateLogById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid gate log id", 400);
  }

  const record = await prisma.gate_logs.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!record) {
    throw new AppError("not_found", "Gate log not found", 404);
  }

  return formatLog(record);
};

export const updateGateLog = async (
  schoolId: string | number | bigint,
  id: string,
  input: GateLogUpdateInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid gate log id", 400);
  }

  const existing = await prisma.gate_logs.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Gate log not found", 404);
  }

  const data: Prisma.gate_logsUpdateInput = {};
  if (input.student_id !== undefined) {
    if (input.student_id) {
      data.student = {
        connect: { id: toBigInt(input.student_id) }
      };
    } else {
      data.student = { disconnect: true };
    }
  }
  if (input.event_type !== undefined) data.event_type = input.event_type;
  if (input.scan_method !== undefined) data.scan_method = input.scan_method;
  if (input.device_id !== undefined) data.device_id = input.device_id;
  if (input.is_flagged !== undefined) data.is_flagged = input.is_flagged;
  if (input.flag_reason !== undefined) data.flag_reason = input.flag_reason;

  const updated = await prisma.gate_logs.update({
    where: { id: existing.id },
    data
  });

  return formatLog(updated);
};

export const deleteGateLog = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid gate log id", 400);
  }

  const existing = await prisma.gate_logs.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Gate log not found", 404);
  }

  await prisma.gate_logs.delete({
    where: { id: existing.id }
  });

  return formatLog(existing);
};
