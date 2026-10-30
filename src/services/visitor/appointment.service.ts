import {
  VisitorAppointmentStatus,
  type VisitorPurpose,
  type Prisma,
  type visitor_appointments
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

type AppointmentCreateInput = {
  visitor_id: string | number | bigint;
  student_id?: string | number | bigint;
  host_id?: string | number | bigint;
  purpose?: VisitorPurpose;
  appointment_at: string | Date;
  expected_duration_min?: number;
  notes?: string;
};

type AppointmentUpdateInput = {
  student_id?: string | number | bigint | null;
  host_id?: string | number | bigint | null;
  purpose?: VisitorPurpose;
  appointment_at?: string | Date;
  expected_duration_min?: number | null;
  notes?: string | null;
  status?: VisitorAppointmentStatus;
};

type AppointmentFilters = {
  visitor_id?: string;
  student_id?: string;
  host_id?: string;
  status?: VisitorAppointmentStatus;
  from_date?: string;
  to_date?: string;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const formatAppointment = (record: visitor_appointments) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  visitor_id: record.visitor_id.toString(),
  student_id: record.student_id ? record.student_id.toString() : null,
  host_id: record.host_id ? record.host_id.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "appointment_at", "status"]);
  if (sort && allowed.has(sort)) {
    return {
      [sort]: order ?? "desc"
    } as Prisma.visitor_appointmentsOrderByWithRelationInput;
  }
  return { appointment_at: "desc" } as Prisma.visitor_appointmentsOrderByWithRelationInput;
};

const assertVisitor = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  visitorId: string | number | bigint
) => {
  const visitor = await tx.visitors.findFirst({
    where: {
      id: toBigInt(visitorId),
      school_id: toBigInt(schoolId)
    }
  });

  if (!visitor) {
    throw new AppError("not_found", "Visitor not found", 404);
  }

  return visitor;
};

const assertStudent = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await tx.students.findFirst({
    where: {
      id: toBigInt(studentId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  return student;
};

const assertVisitorAllowedForStudent = async (
  tx: Prisma.TransactionClient,
  student: { id: bigint; visitor_access_restricted: boolean },
  visitor: { visitor_type: string; phone: string | null; national_id: string | null }
) => {
  if (!student.visitor_access_restricted) return;
  const identifiers = [visitor.phone, visitor.national_id].filter(Boolean) as string[];
  const parent = identifiers.length
    ? await tx.parents_guardians.findFirst({
        where: {
          student_parent_links: { some: { student_id: student.id } },
          OR: [{ phone: { in: identifiers } }, { phone_alt: { in: identifiers } }, { national_id: { in: identifiers } }]
        }
      })
    : null;
  if (visitor.visitor_type !== "parent_guardian" || !parent) {
    throw new AppError("forbidden", "Only a registered parent or guardian may visit this student", 403);
  }
};

const assertHost = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  hostId: string | number | bigint
) => {
  const host = await tx.users.findFirst({
    where: {
      id: toBigInt(hostId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!host) {
    throw new AppError("not_found", "Host user not found", 404);
  }

  return host;
};

const appointmentsOverlap = (
  startA: Date,
  durationA: number | null,
  startB: Date,
  durationB: number | null
) => {
  const endA = new Date(startA.getTime() + (durationA ?? 0) * 60_000);
  const endB = new Date(startB.getTime() + (durationB ?? 0) * 60_000);
  return startA < endB && startB < endA;
};

export const assertNoAppointmentConflict = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  input: {
    visitor_id: string | number | bigint;
    appointment_at: string | Date;
    expected_duration_min?: number | null;
    excludeAppointmentId?: bigint;
  }
) => {
  const appointmentAt = toDateValue(input.appointment_at);
  const duration = input.expected_duration_min ?? 0;

  const candidates = await tx.visitor_appointments.findMany({
    where: {
      school_id: toBigInt(schoolId),
      visitor_id: toBigInt(input.visitor_id),
      appointment_at: { not: null },
      status: { notIn: [VisitorAppointmentStatus.cancelled, VisitorAppointmentStatus.completed] },
      id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined
    }
  });

  const conflict = candidates.find((item) => {
    if (!item.appointment_at) return false;
    if (item.appointment_at.getTime() === appointmentAt.getTime()) return true;
    return appointmentsOverlap(
      appointmentAt,
      duration,
      item.appointment_at,
      item.expected_duration_min
    );
  });

  if (conflict) {
    throw new AppError(
      "conflict",
      "Visitor already has an appointment at this time",
      409
    );
  }
};

const findAppointmentOrThrow = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid appointment id", 400);
  }

  const record = await tx.visitor_appointments.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!record) {
    throw new AppError("not_found", "Visitor appointment not found", 404);
  }

  return record;
};

export const createAppointment = async (
  schoolId: string | number | bigint,
  input: AppointmentCreateInput
) =>
  prisma.$transaction(async (tx) => {
    await assertVisitor(tx, schoolId, input.visitor_id);

    if (input.student_id) {
      const student = await assertStudent(tx, schoolId, input.student_id);
      const visitor = await assertVisitor(tx, schoolId, input.visitor_id);
      await assertVisitorAllowedForStudent(tx, student, visitor);
    }

    if (input.host_id) {
      await assertHost(tx, schoolId, input.host_id);
    }

    await assertNoAppointmentConflict(tx, schoolId, {
      visitor_id: input.visitor_id,
      appointment_at: input.appointment_at,
      expected_duration_min: input.expected_duration_min
    });

    const created = await tx.visitor_appointments.create({
      data: {
        school_id: toBigInt(schoolId),
        visitor_id: toBigInt(input.visitor_id),
        student_id: input.student_id ? toBigInt(input.student_id) : undefined,
        host_id: input.host_id ? toBigInt(input.host_id) : undefined,
        purpose: input.purpose,
        appointment_at: toDateValue(input.appointment_at),
        expected_duration_min: input.expected_duration_min,
        notes: input.notes
      }
    });

    return formatAppointment(created);
  });

export const findAllAppointments = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: AppointmentFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.visitor_appointmentsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.visitor_id) where.visitor_id = toBigInt(filters.visitor_id);
  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.host_id) where.host_id = toBigInt(filters.host_id);
  if (filters.status) where.status = filters.status;

  if (filters.from_date || filters.to_date) {
    where.appointment_at = {};
    if (filters.from_date) {
      where.appointment_at.gte = toDateValue(filters.from_date);
    }
    if (filters.to_date) {
      const end = toDateValue(filters.to_date);
      end.setHours(23, 59, 59, 999);
      where.appointment_at.lte = end;
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.visitor_appointments.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        visitor: { select: { id: true, full_name: true, visitor_type: true } },
        student: { select: { id: true, first_name: true, last_name: true } },
        host: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.visitor_appointments.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatAppointment(item),
      visitor: item.visitor
        ? { ...item.visitor, id: item.visitor.id.toString() }
        : null,
      student: item.student
        ? { ...item.student, id: item.student.id.toString() }
        : null,
      host: item.host ? { ...item.host, id: item.host.id.toString() } : null
    })),
    meta: { page, limit, total }
  };
};

export const findAppointmentById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid appointment id", 400);
  }

  const record = await prisma.visitor_appointments.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      visitor: true,
      student: true,
      host: { select: { id: true, name: true, email: true, phone: true } }
    }
  });

  if (!record) {
    throw new AppError("not_found", "Visitor appointment not found", 404);
  }

  return {
    ...formatAppointment(record),
    visitor: record.visitor
      ? { ...record.visitor, id: record.visitor.id.toString() }
      : null,
    student: record.student
      ? { ...record.student, id: record.student.id.toString() }
      : null,
    host: record.host ? { ...record.host, id: record.host.id.toString() } : null
  };
};

export const updateAppointment = async (
  schoolId: string | number | bigint,
  id: string,
  input: AppointmentUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    const existing = await findAppointmentOrThrow(tx, schoolId, id);

    if (input.student_id) {
      await assertStudent(tx, schoolId, input.student_id);
    }

    if (input.host_id) {
      await assertHost(tx, schoolId, input.host_id);
    }

    const appointmentAt =
      input.appointment_at !== undefined
        ? input.appointment_at
          ? toDateValue(input.appointment_at)
          : null
        : existing.appointment_at;
    const duration =
      input.expected_duration_min !== undefined
        ? input.expected_duration_min
        : existing.expected_duration_min;

    if (appointmentAt) {
      await assertNoAppointmentConflict(tx, schoolId, {
        visitor_id: existing.visitor_id,
        appointment_at: appointmentAt,
        expected_duration_min: duration,
        excludeAppointmentId: existing.id
      });
    }

    const data: Prisma.visitor_appointmentsUncheckedUpdateInput = {};
    if (input.student_id !== undefined) {
      data.student_id = input.student_id ? toBigInt(input.student_id) : null;
    }
    if (input.host_id !== undefined) {
      data.host_id = input.host_id ? toBigInt(input.host_id) : null;
    }
    if (input.purpose !== undefined) data.purpose = input.purpose;
    if (input.appointment_at !== undefined) {
      data.appointment_at = input.appointment_at ? toDateValue(input.appointment_at) : null;
    }
    if (input.expected_duration_min !== undefined) {
      data.expected_duration_min = input.expected_duration_min;
    }
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status !== undefined) data.status = input.status;

    const updated = await tx.visitor_appointments.update({
      where: { id: existing.id },
      data
    });

    return formatAppointment(updated);
  });

export const deleteAppointment = async (schoolId: string | number | bigint, id: string) =>
  prisma.$transaction(async (tx) => {
    const existing = await findAppointmentOrThrow(tx, schoolId, id);

    const linkedVisits = await tx.visitor_visits.count({
      where: { appointment_id: existing.id }
    });

    if (linkedVisits > 0) {
      throw new AppError(
        "conflict",
        "Cannot delete appointment linked to visit records",
        409
      );
    }

    await tx.visitor_appointments.delete({ where: { id: existing.id } });

    return formatAppointment(existing);
  });

const transitionAppointment = async (
  schoolId: string | number | bigint,
  id: string,
  nextStatus: VisitorAppointmentStatus,
  allowedFrom: VisitorAppointmentStatus[]
) =>
  prisma.$transaction(async (tx) => {
    const existing = await findAppointmentOrThrow(tx, schoolId, id);

    if (!allowedFrom.includes(existing.status)) {
      throw new AppError(
        "bad_request",
        `Cannot transition appointment from ${existing.status} to ${nextStatus}`,
        400
      );
    }

    const updated = await tx.visitor_appointments.update({
      where: { id: existing.id },
      data: { status: nextStatus }
    });

    return formatAppointment(updated);
  });

export const confirmAppointment = (schoolId: string | number | bigint, id: string) =>
  transitionAppointment(schoolId, id, VisitorAppointmentStatus.confirmed, [
    VisitorAppointmentStatus.pending
  ]);

export const cancelAppointment = (schoolId: string | number | bigint, id: string) =>
  transitionAppointment(schoolId, id, VisitorAppointmentStatus.cancelled, [
    VisitorAppointmentStatus.pending,
    VisitorAppointmentStatus.confirmed
  ]);

export const completeAppointment = (schoolId: string | number | bigint, id: string) =>
  transitionAppointment(schoolId, id, VisitorAppointmentStatus.completed, [
    VisitorAppointmentStatus.confirmed
  ]);
