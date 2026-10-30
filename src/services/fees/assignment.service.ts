import { FeeAssignmentStatus, type Prisma, type student_fee_assignments } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

type AssignmentCreateInput = {
  student_id: string | number | bigint;
  fee_structure_id: string | number | bigint;
  amount_due?: string | number;
  due_date?: string | Date;
  waiver_reason?: string;
};

type AssignmentUpdateInput = {
  amount_due?: string | number;
  due_date?: string | Date;
  status?: FeeAssignmentStatus;
  waiver_reason?: string;
};

type AssignmentFilters = {
  student_id?: string | number | bigint;
  fee_structure_id?: string | number | bigint;
  status?: FeeAssignmentStatus;
};

type BulkAssignInput = {
  fee_structure_id: string | number | bigint;
  section_id: string | number | bigint;
  academic_year_id?: string | number | bigint;
  term_id?: string | number | bigint;
  due_date?: string | Date;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const toDecimal = (value: string | number) =>
  typeof value === "string" ? value : value.toString();

const formatAssignment = (record: student_fee_assignments) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id.toString(),
  fee_structure_id: record.fee_structure_id.toString(),
  amount_due: record.amount_due.toString(),
  amount_paid: record.amount_paid.toString(),
  balance: record.balance.toString()
});

const resolveAssignmentStatus = (
  amountDue: Prisma.Decimal,
  amountPaid: Prisma.Decimal,
  dueDate: Date | null,
  explicitStatus?: FeeAssignmentStatus
) => {
  if (explicitStatus === FeeAssignmentStatus.waived) {
    return FeeAssignmentStatus.waived;
  }

  const due = Number(amountDue);
  const paid = Number(amountPaid);
  const balance = due - paid;

  if (balance <= 0) {
    return FeeAssignmentStatus.paid;
  }

  if (paid > 0) {
    if (dueDate && dueDate < new Date() && balance > 0) {
      return FeeAssignmentStatus.overdue;
    }
    return FeeAssignmentStatus.partial;
  }

  if (dueDate && dueDate < new Date()) {
    return FeeAssignmentStatus.overdue;
  }

  return FeeAssignmentStatus.unpaid;
};

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "due_date", "status", "balance"]);
  if (sort && allowed.has(sort)) {
    return {
      [sort]: order ?? "desc"
    } as Prisma.student_fee_assignmentsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.student_fee_assignmentsOrderByWithRelationInput;
};

export const assignFeeToStudent = async (
  schoolId: string | number | bigint,
  input: AssignmentCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const student = await tx.students.findFirst({
      where: {
        id: toBigInt(input.student_id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!student) {
      throw new AppError("not_found", "Student not found", 404);
    }

    const structure = await tx.fee_structures.findFirst({
      where: {
        id: toBigInt(input.fee_structure_id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!structure) {
      throw new AppError("not_found", "Fee structure not found", 404);
    }

    const existing = await tx.student_fee_assignments.findFirst({
      where: {
        student_id: student.id,
        fee_structure_id: structure.id
      }
    });

    if (existing) {
      throw new AppError("conflict", "Fee already assigned to this student", 409);
    }

    const amountDue = input.amount_due
      ? toDecimal(input.amount_due)
      : structure.amount.toString();
    const dueDate = input.due_date
      ? toDateValue(input.due_date)
      : structure.due_date;

    const created = await tx.student_fee_assignments.create({
      data: {
        school_id: toBigInt(schoolId),
        student_id: student.id,
        fee_structure_id: structure.id,
        amount_due: amountDue,
        amount_paid: 0,
        balance: amountDue,
        status: FeeAssignmentStatus.unpaid,
        due_date: dueDate ?? undefined,
        waiver_reason: input.waiver_reason
      }
    });

    return formatAssignment(created);
  });

export const bulkAssignBySection = async (
  schoolId: string | number | bigint,
  input: BulkAssignInput
) =>
  prisma.$transaction(async (tx) => {
    const structure = await tx.fee_structures.findFirst({
      where: {
        id: toBigInt(input.fee_structure_id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!structure) {
      throw new AppError("not_found", "Fee structure not found", 404);
    }

    const section = await tx.sections.findFirst({
      where: {
        id: toBigInt(input.section_id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!section) {
      throw new AppError("not_found", "Section not found", 404);
    }

    const enrollmentWhere: Prisma.student_section_enrollmentsWhereInput = {
      school_id: toBigInt(schoolId),
      section_id: section.id,
      status: "active"
    };

    if (input.academic_year_id) {
      enrollmentWhere.academic_year_id = toBigInt(input.academic_year_id);
    }

    if (input.term_id) {
      enrollmentWhere.term_id = toBigInt(input.term_id);
    }

    const enrollments = await tx.student_section_enrollments.findMany({
      where: enrollmentWhere,
      select: { student_id: true }
    });

    const studentIds = [...new Set(enrollments.map((e) => e.student_id))];

    if (studentIds.length === 0) {
      return { created: 0, skipped: 0, assignments: [] };
    }

    const existingAssignments = await tx.student_fee_assignments.findMany({
      where: {
        fee_structure_id: structure.id,
        student_id: { in: studentIds }
      },
      select: { student_id: true }
    });

    const existingStudentIds = new Set(
      existingAssignments.map((a) => a.student_id.toString())
    );

    const amountDue = structure.amount.toString();
    const dueDate = input.due_date
      ? toDateValue(input.due_date)
      : structure.due_date;

    const toCreate = studentIds.filter(
      (studentId) => !existingStudentIds.has(studentId.toString())
    );

    const createdRecords: student_fee_assignments[] = [];

    for (const studentId of toCreate) {
      const created = await tx.student_fee_assignments.create({
        data: {
          school_id: toBigInt(schoolId),
          student_id: studentId,
          fee_structure_id: structure.id,
          amount_due: amountDue,
          amount_paid: 0,
          balance: amountDue,
          status: FeeAssignmentStatus.unpaid,
          due_date: dueDate ?? undefined
        }
      });
      createdRecords.push(created);
    }

    return {
      created: createdRecords.length,
      skipped: studentIds.length - createdRecords.length,
      assignments: createdRecords.map(formatAssignment)
    };
  });

export const findAllAssignments = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: AssignmentFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.student_fee_assignmentsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.fee_structure_id) {
    where.fee_structure_id = toBigInt(filters.fee_structure_id);
  }
  if (filters.status) where.status = filters.status;

  const [items, total] = await prisma.$transaction([
    prisma.student_fee_assignments.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        student: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            student_id_number: true
          }
        },
        fee_structure: { select: { id: true, name: true, amount: true } }
      }
    }),
    prisma.student_fee_assignments.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatAssignment(item),
      student: item.student
        ? {
            ...item.student,
            id: item.student.id.toString()
          }
        : null,
      fee_structure: item.fee_structure
        ? {
            ...item.fee_structure,
            id: item.fee_structure.id.toString(),
            amount: item.fee_structure.amount.toString()
          }
        : null
    })),
    meta: { page, limit, total }
  };
};

export const findAssignmentById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid assignment id", 400);
  }

  const record = await prisma.student_fee_assignments.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      student: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          student_id_number: true
        }
      },
      fee_structure: true
    }
  });

  if (!record) {
    throw new AppError("not_found", "Fee assignment not found", 404);
  }

  return {
    ...formatAssignment(record),
    student: record.student
      ? { ...record.student, id: record.student.id.toString() }
      : null,
    fee_structure: record.fee_structure
      ? {
          ...formatFeeStructureFromAssignment(record.fee_structure),
          amount: record.fee_structure.amount.toString()
        }
      : null
  };
};

const formatFeeStructureFromAssignment = (record: {
  id: bigint;
  school_id: bigint;
  academic_year_id: bigint;
  term_id: bigint | null;
  class_id: bigint | null;
  name: string;
  amount: Prisma.Decimal;
  currency: string;
  is_mandatory: boolean;
  due_date: Date | null;
  created_at: Date;
  updated_at: Date;
}) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  academic_year_id: record.academic_year_id.toString(),
  term_id: record.term_id ? record.term_id.toString() : null,
  class_id: record.class_id ? record.class_id.toString() : null
});

export const updateAssignment = async (
  schoolId: string | number | bigint,
  id: string,
  input: AssignmentUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid assignment id", 400);
    }

    const existing = await tx.student_fee_assignments.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Fee assignment not found", 404);
    }

    const amountDue =
      input.amount_due !== undefined
        ? toDecimal(input.amount_due)
        : existing.amount_due.toString();
    const amountPaid = existing.amount_paid;
    const balance = (Number(amountDue) - Number(amountPaid)).toFixed(2);
    const dueDate =
      input.due_date !== undefined
        ? input.due_date
          ? toDateValue(input.due_date)
          : null
        : existing.due_date;

    const status = resolveAssignmentStatus(
      { toString: () => amountDue } as Prisma.Decimal,
      amountPaid,
      dueDate,
      input.status
    );

    const updated = await tx.student_fee_assignments.update({
      where: { id: existing.id },
      data: {
        amount_due: amountDue,
        balance,
        due_date: dueDate,
        status: input.status ?? status,
        waiver_reason: input.waiver_reason
      }
    });

    return formatAssignment(updated);
  });

export const deleteAssignment = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid assignment id", 400);
    }

    const existing = await tx.student_fee_assignments.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      },
      include: { _count: { select: { fee_transactions: true } } }
    });

    if (!existing) {
      throw new AppError("not_found", "Fee assignment not found", 404);
    }

    if (existing._count.fee_transactions > 0) {
      throw new AppError(
        "conflict",
        "Cannot delete assignment with recorded payments",
        409
      );
    }

    await tx.student_fee_assignments.delete({ where: { id: existing.id } });

    return formatAssignment(existing);
  });
