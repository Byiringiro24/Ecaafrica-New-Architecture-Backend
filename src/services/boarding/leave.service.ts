import type { Prisma, student_leave_requests } from "@prisma/client";
import {
  StudentLeaveRequestSource,
  StudentLeaveStatus,
  StudentLeaveType,
  StudentType,
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { createNotification } from "../app.service";
import { assertDates, assertNoLeaveConflict } from "./leave.helpers";

type LeaveCreateInput = {
  student_id: string | number | bigint;
  parent_id?: string | number | bigint;
  requested_by?: string | number | bigint;
  source?: StudentLeaveRequestSource;
  leave_type?: StudentLeaveType;
  start_date: string | Date;
  end_date: string | Date;
  reason?: string;
  destination?: string;
  parent_contact?: string;
  expected_return_at?: string | Date;
};

type LeaveUpdateInput = {
  student_id?: string | number | bigint;
  parent_id?: string | number | bigint | null;
  leave_type?: StudentLeaveType;
  start_date?: string | Date;
  end_date?: string | Date;
  reason?: string | null;
  status?: StudentLeaveStatus;
  exited_at?: string | Date | null;
  returned_at?: string | Date | null;
  is_unauthorized?: boolean;
  clarification_note?: string | null;
};

type LeaveFilters = {
  student_id?: string | number | bigint;
  status?: StudentLeaveStatus;
  from_date?: string;
  to_date?: string;
  is_unauthorized?: boolean;
  dormitory_ids?: bigint[];
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const formatLeave = (record: student_leave_requests) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id.toString(),
  parent_id: record.parent_id ? record.parent_id.toString() : null,
  approved_by: record.approved_by ? record.approved_by.toString() : null,
  requested_by: record.requested_by ? record.requested_by.toString() : null,
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "start_date", "end_date", "status"]);
  if (sort && allowed.has(sort)) {
    return {
      [sort]: order ?? "desc",
    } as Prisma.student_leave_requestsOrderByWithRelationInput;
  }

  return {
    start_date: "desc",
  } as Prisma.student_leave_requestsOrderByWithRelationInput;
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

const assertParent = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  parentId: string | number | bigint,
) => {
  const parent = await tx.parents_guardians.findFirst({
    where: {
      id: toBigInt(parentId),
      school_id: toBigInt(schoolId),
    },
  });

  if (!parent) {
    throw new AppError("not_found", "Parent not found", 404);
  }

  return parent;
};

export const createStudentLeave = async (
  schoolId: string | number | bigint,
  input: LeaveCreateInput,
) =>
  prisma.$transaction(async (tx) => {
    await assertStudentBoarding(tx, schoolId, input.student_id);

    if (input.parent_id) {
      await assertParent(tx, schoolId, input.parent_id);
    }

    const startDate = toDateValue(input.start_date);
    const endDate = toDateValue(input.end_date);
    assertDates(startDate, endDate);

    await assertNoLeaveConflict(
      tx,
      schoolId,
      input.student_id,
      startDate,
      endDate,
    );

    const created = await tx.student_leave_requests.create({
      data: {
        school_id: toBigInt(schoolId),
        student_id: toBigInt(input.student_id),
        parent_id: input.parent_id ? toBigInt(input.parent_id) : undefined,
        requested_by: input.requested_by
          ? toBigInt(input.requested_by)
          : undefined,
        source: input.source ?? StudentLeaveRequestSource.dod,
        leave_type: input.leave_type ?? StudentLeaveType.weekend,
        start_date: startDate,
        end_date: endDate,
        reason: input.reason,
        destination: input.destination,
        parent_contact: input.parent_contact,
        expected_return_time: input.expected_return_at
          ? toDateValue(input.expected_return_at)
          : undefined,
      },
    });

    return formatLeave(created);
  });

export const listStudentLeaves = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: LeaveFilters = {},
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.student_leave_requestsWhereInput = {
    school_id: toBigInt(schoolId),
  };

  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.status) where.status = filters.status;
  if (filters.is_unauthorized !== undefined)
    where.is_unauthorized = filters.is_unauthorized;
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

  if (filters.from_date || filters.to_date) {
    where.start_date = {
      gte: filters.from_date ? new Date(filters.from_date) : undefined,
      lte: filters.to_date ? new Date(filters.to_date) : undefined,
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.student_leave_requests.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student_leave_requests.count({ where }),
  ]);

  return {
    data: items.map((item) => formatLeave(item)),
    meta: { page, limit, total },
  };
};

export const findStudentLeaveById = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid leave request id", 400);
  }

  const record = await prisma.student_leave_requests.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!record) {
    throw new AppError("not_found", "Leave request not found", 404);
  }

  return formatLeave(record);
};

export const updateStudentLeave = async (
  schoolId: string | number | bigint,
  id: string,
  input: LeaveUpdateInput,
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid leave request id", 400);
    }

    const existing = await tx.student_leave_requests.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
      },
    });

    if (!existing) {
      throw new AppError("not_found", "Leave request not found", 404);
    }

    const studentId = input.student_id ?? existing.student_id;
    const startDate = input.start_date
      ? toDateValue(input.start_date)
      : existing.start_date;
    const endDate = input.end_date
      ? toDateValue(input.end_date)
      : existing.end_date;

    if (input.student_id) {
      await assertStudentBoarding(tx, schoolId, input.student_id);
    }

    if (input.parent_id) {
      await assertParent(tx, schoolId, input.parent_id);
    }

    if (input.start_date || input.end_date) {
      assertDates(startDate, endDate);
      await assertNoLeaveConflict(
        tx,
        schoolId,
        studentId,
        startDate,
        endDate,
        existing.id,
      );
    }

    const shouldAutoApprove =
      input.returned_at &&
      input.status === undefined &&
      existing.status === StudentLeaveStatus.pending;

    const updated = await tx.student_leave_requests.update({
      where: { id: existing.id },
      data: {
        student_id: input.student_id ? toBigInt(input.student_id) : undefined,
        parent_id:
          input.parent_id === undefined
            ? undefined
            : input.parent_id
              ? toBigInt(input.parent_id)
              : null,
        leave_type: input.leave_type,
        start_date: input.start_date ? startDate : undefined,
        end_date: input.end_date ? endDate : undefined,
        reason: input.reason === undefined ? undefined : input.reason,
        status: shouldAutoApprove ? StudentLeaveStatus.approved : input.status,
        exited_at:
          input.exited_at === undefined
            ? undefined
            : input.exited_at
              ? toDateValue(input.exited_at)
              : null,
        returned_at:
          input.returned_at === undefined
            ? undefined
            : input.returned_at
              ? toDateValue(input.returned_at)
              : null,
        is_unauthorized: input.is_unauthorized,
        clarification_note:
          input.clarification_note === undefined
            ? undefined
            : input.clarification_note,
      },
    });

    return formatLeave(updated);
  });

export const deleteStudentLeave = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid leave request id", 400);
  }

  const existing = await prisma.student_leave_requests.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!existing) {
    throw new AppError("not_found", "Leave request not found", 404);
  }

  await prisma.student_leave_requests.delete({ where: { id: existing.id } });
  return formatLeave(existing);
};

export const approveStudentLeave = async (
  schoolId: string | number | bigint,
  id: string,
  approvedBy: string | number | bigint,
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid leave request id", 400);
    }

    const existing = await tx.student_leave_requests.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
      },
      include: {
        student: { select: { id: true, first_name: true, last_name: true } },
        parent: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new AppError("not_found", "Leave request not found", 404);
    }

    if (existing.status === StudentLeaveStatus.rejected) {
      throw new AppError("conflict", "Leave request already rejected", 409);
    }

    if (existing.status === StudentLeaveStatus.cancelled) {
      throw new AppError("conflict", "Leave request already cancelled", 409);
    }

    const updated = await tx.student_leave_requests.update({
      where: { id: existing.id },
      data: {
        status: StudentLeaveStatus.approved,
        approved_by: toBigInt(approvedBy),
        approved_at: new Date(),
        rejection_reason: null,
      },
    });

    // Create in-app notification for parent via raw SQL
    if (existing.parent_id) {
      const studentName = `${existing.student.first_name} ${existing.student.last_name}`;
      await createNotification(
        existing.parent_id,
        existing.school_id,
        {
          title: "Leave Approved",
          body: `Leave request for ${studentName} has been approved.`,
          type: "leave_approved",
          studentId: existing.student_id,
          metadata: {
            leave_id: existing.id.toString(),
            leave_type: existing.leave_type,
            start_date: existing.start_date.toISOString().split("T")[0],
            end_date: existing.end_date.toISOString().split("T")[0],
          },
        },
        tx,
      );
    }

    return formatLeave(updated);
  });

export const rejectStudentLeave = async (
  schoolId: string | number | bigint,
  id: string,
  rejectedBy: string | number | bigint,
  reason: string,
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid leave request id", 400);
    }

    const existing = await tx.student_leave_requests.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
      },
      include: {
        student: { select: { id: true, first_name: true, last_name: true } },
      },
    });

    if (!existing) {
      throw new AppError("not_found", "Leave request not found", 404);
    }

    if (existing.status === StudentLeaveStatus.approved) {
      throw new AppError("conflict", "Leave request already approved", 409);
    }

    if (existing.status === StudentLeaveStatus.cancelled) {
      throw new AppError("conflict", "Leave request already cancelled", 409);
    }

    const updated = await tx.student_leave_requests.update({
      where: { id: existing.id },
      data: {
        status: StudentLeaveStatus.rejected,
        approved_by: toBigInt(rejectedBy),
        approved_at: new Date(),
        rejection_reason: reason,
      },
    });

    // Parents get told about rejections too — without this the request just
    // silently stops moving from their side.
    if (existing.parent_id) {
      const studentName = `${existing.student.first_name} ${existing.student.last_name}`;
      await createNotification(
        existing.parent_id,
        existing.school_id,
        {
          title: "Leave Rejected",
          body: `Leave request for ${studentName} was rejected: ${reason}`,
          type: "leave_rejected",
          studentId: existing.student_id,
          metadata: {
            leave_id: existing.id.toString(),
            leave_type: existing.leave_type,
            start_date: existing.start_date.toISOString().split("T")[0],
            end_date: existing.end_date.toISOString().split("T")[0],
            rejection_reason: reason,
          },
        },
        tx,
      );
    }

    return formatLeave(updated);
  });

export const requestLeaveClarification = async (
  schoolId: string | number | bigint,
  id: string,
  note: string,
) => {
  if (!/^\d+$/.test(id))
    throw new AppError("bad_request", "Invalid leave request id", 400);
  const record = await prisma.student_leave_requests.findFirst({
    where: { id: toBigInt(id), school_id: toBigInt(schoolId) },
  });
  if (!record) throw new AppError("not_found", "Leave request not found", 404);
  if (record.status !== StudentLeaveStatus.pending) {
    throw new AppError(
      "conflict",
      "Clarification can only be requested for a pending leave",
      409,
    );
  }
  const updated = await prisma.student_leave_requests.update({
    where: { id: record.id },
    data: { clarification_note: note },
  });
  return formatLeave(updated);
};
