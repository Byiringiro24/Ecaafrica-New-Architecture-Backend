import {
  NotificationRecipientType,
  VisitorAppointmentStatus,
  type Prisma,
  type visitor_visits
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import { sendSMS } from "../notification/sender.service";

type VisitCreateInput = {
  visitor_id: string | number | bigint;
  appointment_id?: string | number | bigint;
  student_id?: string | number | bigint;
  host_id?: string | number | bigint;
  purpose?: string;
  checked_in_at?: string | Date;
  expected_duration_min?: number;
  expected_out_at?: string | Date;
  notes?: string;
  badge_printed?: boolean;
  sms_sent_host?: boolean;
  checked_in_by?: string | number | bigint;
};

type VisitUpdateInput = {
  appointment_id?: string | number | bigint | null;
  student_id?: string | number | bigint | null;
  host_id?: string | number | bigint | null;
  purpose?: string | null;
  expected_out_at?: string | Date | null;
  checked_out_at?: string | Date;
  notes?: string | null;
  badge_printed?: boolean;
  sms_sent_host?: boolean;
  checked_out_by?: string | number | bigint;
};

type VisitFilters = {
  visitor_id?: string;
  student_id?: string;
  appointment_id?: string;
  active_only?: boolean;
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

const formatVisit = (record: visitor_visits) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  visitor_id: record.visitor_id.toString(),
  appointment_id: record.appointment_id ? record.appointment_id.toString() : null,
  student_id: record.student_id ? record.student_id.toString() : null,
  host_id: record.host_id ? record.host_id.toString() : null,
  checked_in_by: record.checked_in_by ? record.checked_in_by.toString() : null,
  checked_out_by: record.checked_out_by ? record.checked_out_by.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["checked_in_at", "checked_out_at", "expected_out_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.visitor_visitsOrderByWithRelationInput;
  }
  return { checked_in_at: "desc" } as Prisma.visitor_visitsOrderByWithRelationInput;
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

const assertAppointment = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  appointmentId: string | number | bigint,
  visitorId: string | number | bigint
) => {
  const appointment = await tx.visitor_appointments.findFirst({
    where: {
      id: toBigInt(appointmentId),
      school_id: toBigInt(schoolId),
      visitor_id: toBigInt(visitorId)
    }
  });

  if (!appointment) {
    throw new AppError("not_found", "Visitor appointment not found for this visitor", 404);
  }

  if (appointment.status === VisitorAppointmentStatus.cancelled) {
    throw new AppError("bad_request", "Cannot check in against a cancelled appointment", 400);
  }

  return appointment;
};

const findVisitOrThrow = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid visit id", 400);
  }

  const record = await tx.visitor_visits.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!record) {
    throw new AppError("not_found", "Visitor visit not found", 404);
  }

  return record;
};

export const logEntry = async (
  schoolId: string | number | bigint,
  input: VisitCreateInput
) => {
  // A visitor's check-in time is an audit value and must come from the
  // backend, never from a browser/device clock.
  const serverNow = new Date();
  const record = await prisma.$transaction(async (tx) => {
    const visitor = await assertVisitor(tx, schoolId, input.visitor_id);

    let appointment = null;
    if (input.appointment_id) {
      appointment = await assertAppointment(
        tx,
        schoolId,
        input.appointment_id,
        input.visitor_id
      );
    }

    const studentId = input.student_id ?? appointment?.student_id;
    const hostId = input.host_id ?? appointment?.host_id;

    if (studentId) {
      const student = await assertStudent(tx, schoolId, studentId);
      await assertVisitorAllowedForStudent(tx, student, visitor);
    }

    if (hostId) {
      await assertHost(tx, schoolId, hostId);
    }

    const openVisit = await tx.visitor_visits.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        visitor_id: toBigInt(input.visitor_id),
        checked_out_at: null
      }
    });

    if (openVisit) {
      throw new AppError("conflict", "Visitor already has an active visit (not checked out)", 409);
    }

    const created = await tx.visitor_visits.create({
      data: {
        school_id: toBigInt(schoolId),
        visitor_id: toBigInt(input.visitor_id),
        appointment_id: input.appointment_id
          ? toBigInt(input.appointment_id)
          : appointment
            ? appointment.id
            : undefined,
        student_id: studentId ? toBigInt(studentId) : undefined,
        host_id: hostId ? toBigInt(hostId) : undefined,
        checked_in_by: input.checked_in_by ? toBigInt(input.checked_in_by) : undefined,
        purpose: input.purpose ?? appointment?.purpose ?? undefined,
        checked_in_at: serverNow,
        expected_out_at: input.expected_duration_min
          ? new Date(serverNow.getTime() + input.expected_duration_min * 60_000)
          : undefined,
        notes: input.notes,
        badge_printed: input.badge_printed,
        sms_sent_host: input.sms_sent_host
      }
    });

    return formatVisit(created);
  });

  await notifyParentOfVisitor(schoolId, record);
  return record;
};

const notifyParentOfVisitor = async (
  schoolId: string | number | bigint,
  visit: ReturnType<typeof formatVisit>
) => {
  if (!visit.student_id) {
    return;
  }

  const [visitor, studentParent] = await Promise.all([
    prisma.visitors.findFirst({
      where: { id: toBigInt(visit.visitor_id), school_id: toBigInt(schoolId) },
      select: { full_name: true }
    }),
    prisma.student_parent_links.findFirst({
      where: {
        student_id: toBigInt(visit.student_id),
        student: { school_id: toBigInt(schoolId), deleted_at: null }
      },
      orderBy: [{ is_primary: "desc" }, { id: "asc" }],
      select: {
        parent: { select: { id: true, phone: true } },
        student: { select: { first_name: true, last_name: true } }
      }
    })
  ]);

  if (!visitor?.full_name || !studentParent?.parent.phone) {
    return;
  }

  const studentName = [
    studentParent.student.first_name,
    studentParent.student.last_name
  ].filter(Boolean).join(" ");
  const message = `Education Care\nVisitor Alert: ${visitor.full_name} has arrived to visit ${studentName}.`;

  try {
    await sendSMS(studentParent.parent.phone, message, undefined, schoolId, {
      recipientType: NotificationRecipientType.parent,
      recipientId: studentParent.parent.id,
      triggerType: "visitor_arrival"
    });
  } catch (error) {
    logger.warn(
      { err: error, schoolId: String(schoolId), visitId: visit.id },
      "Could not send visitor arrival SMS to parent"
    );
  }
};

export const logExit = async (
  schoolId: string | number | bigint,
  id: string,
  input: Pick<VisitUpdateInput, "checked_out_at" | "checked_out_by" | "notes"> = {}
) =>
  prisma.$transaction(async (tx) => {
    const existing = await findVisitOrThrow(tx, schoolId, id);

    if (existing.checked_out_at) {
      throw new AppError("bad_request", "Visit already checked out", 400);
    }

    const updated = await tx.visitor_visits.update({
      where: { id: existing.id },
      data: {
        // Ignore any client-supplied checked_out_at value.
        checked_out_at: new Date(),
        checked_out_by: input.checked_out_by ? toBigInt(input.checked_out_by) : undefined,
        notes: input.notes !== undefined ? input.notes : existing.notes
      }
    });

    return formatVisit(updated);
  });

export const createVisit = logEntry;

export const findAllVisits = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: VisitFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.visitor_visitsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.visitor_id) where.visitor_id = toBigInt(filters.visitor_id);
  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.appointment_id) where.appointment_id = toBigInt(filters.appointment_id);
  if (filters.active_only) where.checked_out_at = null;

  if (filters.from_date || filters.to_date) {
    where.checked_in_at = {};
    if (filters.from_date) {
      where.checked_in_at.gte = toDateValue(filters.from_date);
    }
    if (filters.to_date) {
      const end = toDateValue(filters.to_date);
      end.setHours(23, 59, 59, 999);
      where.checked_in_at.lte = end;
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.visitor_visits.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        visitor: { select: { id: true, full_name: true, visitor_type: true } },
        appointment: { select: { id: true, purpose: true, appointment_at: true } },
        student: { select: { id: true, first_name: true, last_name: true } }
      }
    }),
    prisma.visitor_visits.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatVisit(item),
      visitor: item.visitor
        ? { ...item.visitor, id: item.visitor.id.toString() }
        : null,
      appointment: item.appointment
        ? { ...item.appointment, id: item.appointment.id.toString() }
        : null,
      student: item.student
        ? { ...item.student, id: item.student.id.toString() }
        : null
    })),
    meta: { page, limit, total }
  };
};

export const findVisitById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid visit id", 400);
  }

  const record = await prisma.visitor_visits.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      visitor: true,
      appointment: true,
      student: true,
      host: { select: { id: true, name: true, email: true } }
    }
  });

  if (!record) {
    throw new AppError("not_found", "Visitor visit not found", 404);
  }

  return {
    ...formatVisit(record),
    visitor: record.visitor
      ? { ...record.visitor, id: record.visitor.id.toString() }
      : null,
    appointment: record.appointment
      ? { ...record.appointment, id: record.appointment.id.toString() }
      : null,
    student: record.student
      ? { ...record.student, id: record.student.id.toString() }
      : null,
    host: record.host ? { ...record.host, id: record.host.id.toString() } : null
  };
};

export const updateVisit = async (
  schoolId: string | number | bigint,
  id: string,
  input: VisitUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    const existing = await findVisitOrThrow(tx, schoolId, id);

    if (input.student_id) {
      await assertStudent(tx, schoolId, input.student_id);
    }

    if (input.host_id) {
      await assertHost(tx, schoolId, input.host_id);
    }

    if (input.appointment_id) {
      await assertAppointment(tx, schoolId, input.appointment_id, existing.visitor_id);
    }

    const data: Prisma.visitor_visitsUncheckedUpdateInput = {};
    if (input.appointment_id !== undefined) {
      data.appointment_id = input.appointment_id ? toBigInt(input.appointment_id) : null;
    }
    if (input.student_id !== undefined) {
      data.student_id = input.student_id ? toBigInt(input.student_id) : null;
    }
    if (input.host_id !== undefined) {
      data.host_id = input.host_id ? toBigInt(input.host_id) : null;
    }
    if (input.purpose !== undefined) data.purpose = input.purpose;
    if (input.expected_out_at !== undefined) {
      data.expected_out_at = input.expected_out_at ? toDateValue(input.expected_out_at) : null;
    }
    if (input.checked_out_at !== undefined) {
      // A checkout timestamp is also an audit value and comes from the server.
      data.checked_out_at = new Date();
      if (input.checked_out_by) {
        data.checked_out_by = toBigInt(input.checked_out_by);
      }
    }
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.badge_printed !== undefined) data.badge_printed = input.badge_printed;
    if (input.sms_sent_host !== undefined) data.sms_sent_host = input.sms_sent_host;

    const updated = await tx.visitor_visits.update({
      where: { id: existing.id },
      data
    });

    return formatVisit(updated);
  });

export const deleteVisit = async (schoolId: string | number | bigint, id: string) =>
  prisma.$transaction(async (tx) => {
    const existing = await findVisitOrThrow(tx, schoolId, id);
    await tx.visitor_visits.delete({ where: { id: existing.id } });
    return formatVisit(existing);
  });
