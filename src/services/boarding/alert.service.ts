import type { Prisma, absence_alerts } from "@prisma/client";
import { AlertStatus } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { emitAbsenceAlert } from "../../sockets/notification.socket";

type AlertCreateInput = {
  student_id: string | number | bigint;
  alert_type: Prisma.absence_alertsCreateInput["alert_type"];
  severity?: Prisma.absence_alertsCreateInput["severity"];
  description?: string;
};

type AlertUpdateInput = {
  alert_type?: Prisma.absence_alertsUpdateInput["alert_type"];
  severity?: Prisma.absence_alertsUpdateInput["severity"];
  description?: string | null;
};

type AlertFilters = {
  student_id?: string | number | bigint;
  status?: AlertStatus;
  alert_type?: Prisma.absence_alertsWhereInput["alert_type"];
  severity?: Prisma.absence_alertsWhereInput["severity"];
  dormitory_ids?: bigint[];
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatAlert = (record: absence_alerts) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id.toString(),
  resolved_by: record.resolved_by ? record.resolved_by.toString() : null,
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "severity", "status"]);
  if (sort && allowed.has(sort)) {
    return {
      [sort]: order ?? "desc",
    } as Prisma.absence_alertsOrderByWithRelationInput;
  }

  return {
    created_at: "desc",
  } as Prisma.absence_alertsOrderByWithRelationInput;
};

const assertStudent = async (
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

  return student;
};

const assertResolver = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  userId: string | number | bigint,
) => {
  const user = await tx.users.findFirst({
    where: {
      id: toBigInt(userId),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
  });

  if (!user) {
    throw new AppError("not_found", "User not found", 404);
  }

  return user;
};

export const createAlert = async (
  schoolId: string | number | bigint,
  input: AlertCreateInput,
) =>
  prisma.$transaction(async (tx) => {
    await assertStudent(tx, schoolId, input.student_id);

    const created = await tx.absence_alerts.create({
      data: {
        school_id: toBigInt(schoolId),
        student_id: toBigInt(input.student_id),
        alert_type: input.alert_type,
        severity: input.severity,
        description: input.description,
      },
    });

    const formatted = formatAlert(created);
    emitAbsenceAlert(formatted.school_id, formatted);

    return formatted;
  });

export const listAlerts = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: AlertFilters = {},
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.absence_alertsWhereInput = {
    school_id: toBigInt(schoolId),
  };

  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.status) where.status = filters.status;
  if (filters.alert_type) where.alert_type = filters.alert_type;
  if (filters.severity) where.severity = filters.severity;
  if (filters.dormitory_ids) {
    where.student = {
      student_dorm_assignments: {
        some: {
          school_id: toBigInt(schoolId),
          dormitory_id: { in: filters.dormitory_ids },
          left_at: null,
        },
      },
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.absence_alerts.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.absence_alerts.count({ where }),
  ]);

  return {
    data: items.map((item) => formatAlert(item)),
    meta: { page, limit, total },
  };
};

export const getActiveAlerts = async (schoolId: string | number | bigint) => {
  const records = await prisma.absence_alerts.findMany({
    where: {
      school_id: toBigInt(schoolId),
      status: AlertStatus.active,
    },
    orderBy: { created_at: "desc" },
  });

  return records.map((item) => formatAlert(item));
};

export const findAlertById = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid alert id", 400);
  }

  const record = await prisma.absence_alerts.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!record) {
    throw new AppError("not_found", "Alert not found", 404);
  }

  return formatAlert(record);
};

export const updateAlert = async (
  schoolId: string | number | bigint,
  id: string,
  input: AlertUpdateInput,
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid alert id", 400);
    }

    const existing = await tx.absence_alerts.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
      },
    });

    if (!existing) {
      throw new AppError("not_found", "Alert not found", 404);
    }

    const updated = await tx.absence_alerts.update({
      where: { id: existing.id },
      data: {
        alert_type: input.alert_type,
        severity: input.severity,
        description: input.description,
      },
    });

    return formatAlert(updated);
  });

export const resolveAlert = async (
  schoolId: string | number | bigint,
  id: string,
  resolvedBy: string | number | bigint,
  resolutionNote?: string,
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid alert id", 400);
    }

    const existing = await tx.absence_alerts.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
      },
    });

    if (!existing) {
      throw new AppError("not_found", "Alert not found", 404);
    }

    await assertResolver(tx, schoolId, resolvedBy);

    const updated = await tx.absence_alerts.update({
      where: { id: existing.id },
      data: {
        status: AlertStatus.resolved,
        resolved_by: toBigInt(resolvedBy),
        resolved_at: new Date(),
        resolution_note: resolutionNote ?? null,
      },
    });

    return formatAlert(updated);
  });

export const deleteAlert = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid alert id", 400);
  }

  const existing = await prisma.absence_alerts.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!existing) {
    throw new AppError("not_found", "Alert not found", 404);
  }

  await prisma.absence_alerts.delete({ where: { id: existing.id } });
  return formatAlert(existing);
};
