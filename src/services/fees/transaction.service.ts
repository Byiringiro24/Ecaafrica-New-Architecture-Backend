import {
  FeeAssignmentStatus,
  type PaymentMethod,
  type Prisma,
  type fee_transactions
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AuditActorType } from "../../constants/enums";
import { AppError } from "../../middleware/errorHandler";
import { logAction } from "../audit.service";

type TransactionCreateInput = {
  student_id: string | number | bigint;
  fee_assignment_id?: string | number | bigint;
  amount: string | number;
  payment_method?: PaymentMethod;
  payment_ref?: string;
  paid_at?: string | Date;
  notes?: string;
  currency?: string;
  receipt_url?: string;
  received_by?: string | number | bigint;
};

type TransactionUpdateInput = {
  payment_ref?: string;
  notes?: string;
};

type TransactionFilters = {
  student_id?: string | number | bigint;
  fee_assignment_id?: string | number | bigint;
  from_date?: string | Date;
  to_date?: string | Date;
};

type FeeSummaryFilters = {
  term_id?: string | number | bigint;
  academic_year_id?: string | number | bigint;
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

const generateReceiptNumber = () => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RCP-${Date.now()}-${suffix}`.slice(0, 30);
};

const formatTransaction = (record: fee_transactions) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id.toString(),
  fee_assignment_id: record.fee_assignment_id
    ? record.fee_assignment_id.toString()
    : null,
  received_by: record.received_by ? record.received_by.toString() : null,
  amount: record.amount.toString()
});

const resolveAssignmentStatusAfterPayment = (
  amountDue: Prisma.Decimal,
  amountPaid: Prisma.Decimal,
  dueDate: Date | null
) => {
  const due = Number(amountDue);
  const paid = Number(amountPaid);
  const balance = due - paid;

  if (balance <= 0) return FeeAssignmentStatus.paid;
  if (paid > 0) {
    if (dueDate && dueDate < new Date() && balance > 0) {
      return FeeAssignmentStatus.overdue;
    }
    return FeeAssignmentStatus.partial;
  }
  if (dueDate && dueDate < new Date()) return FeeAssignmentStatus.overdue;
  return FeeAssignmentStatus.unpaid;
};

const applyPaymentToAssignment = async (
  tx: Prisma.TransactionClient,
  assignmentId: bigint,
  paymentAmount: string | number
) => {
  const assignment = await tx.student_fee_assignments.findUnique({
    where: { id: assignmentId }
  });

  if (!assignment) {
    throw new AppError("not_found", "Fee assignment not found", 404);
  }

  const newPaid = Number(assignment.amount_paid) + Number(paymentAmount);
  const newBalance = Number(assignment.amount_due) - newPaid;
  const status = resolveAssignmentStatusAfterPayment(
    assignment.amount_due,
    { toString: () => newPaid.toFixed(2) } as Prisma.Decimal,
    assignment.due_date
  );

  await tx.student_fee_assignments.update({
    where: { id: assignment.id },
    data: {
      amount_paid: newPaid.toFixed(2),
      balance: Math.max(newBalance, 0).toFixed(2),
      status
    }
  });
};

export const recordPayment = async (
  schoolId: string | number | bigint,
  input: TransactionCreateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
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

    if (input.fee_assignment_id) {
      const assignment = await tx.student_fee_assignments.findFirst({
        where: {
          id: toBigInt(input.fee_assignment_id),
          school_id: toBigInt(schoolId),
          student_id: student.id
        }
      });

      if (!assignment) {
        throw new AppError("not_found", "Fee assignment not found for student", 404);
      }
    }

    const created = await tx.fee_transactions.create({
      data: {
        school_id: toBigInt(schoolId),
        student_id: student.id,
        fee_assignment_id: input.fee_assignment_id
          ? toBigInt(input.fee_assignment_id)
          : undefined,
        receipt_number: generateReceiptNumber(),
        amount: toDecimal(input.amount),
        currency: input.currency ?? "RWF",
        payment_method: input.payment_method ?? "cash",
        payment_ref: input.payment_ref,
        paid_at: input.paid_at ? toDateValue(input.paid_at) : new Date(),
        received_by: input.received_by ? toBigInt(input.received_by) : undefined,
        notes: input.notes,
        receipt_url: input.receipt_url
      }
    });

    if (input.fee_assignment_id) {
      await applyPaymentToAssignment(tx, toBigInt(input.fee_assignment_id), input.amount);
    }

    return formatTransaction(created);
  });

  void logAction(null, AuditActorType.SYSTEM, "record_payment", "fee_transactions", result.id, {
    schoolId,
    resourceName: result.receipt_number,
    newValues: { amount: result.amount, student_id: result.student_id },
    severity: "info"
  });

  return result;
};

export const getStudentBalance = async (
  schoolId: string | number | bigint,
  studentId: string
) => {
  if (!/^\d+$/.test(studentId)) {
    throw new AppError("bad_request", "Invalid student id", 400);
  }

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

  const assignments = await prisma.student_fee_assignments.findMany({
    where: {
      school_id: toBigInt(schoolId),
      student_id: student.id
    }
  });

  const totalAssigned = assignments.reduce(
    (sum, a) => sum + Number(a.amount_due),
    0
  );
  const totalPaid = assignments.reduce((sum, a) => sum + Number(a.amount_paid), 0);
  const totalBalance = assignments.reduce((sum, a) => sum + Number(a.balance), 0);

  return {
    student_id: student.id.toString(),
    total_assigned: totalAssigned.toFixed(2),
    total_paid: totalPaid.toFixed(2),
    balance: totalBalance.toFixed(2),
    assignment_count: assignments.length
  };
};

export const getSchoolFeeSummary = async (
  schoolId: string | number | bigint,
  filters: FeeSummaryFilters = {}
) => {
  const structureWhere: Prisma.fee_structuresWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.term_id) structureWhere.term_id = toBigInt(filters.term_id);
  if (filters.academic_year_id) {
    structureWhere.academic_year_id = toBigInt(filters.academic_year_id);
  }

  const structureIds = (
    await prisma.fee_structures.findMany({
      where: structureWhere,
      select: { id: true }
    })
  ).map((s) => s.id);

  const assignmentWhere: Prisma.student_fee_assignmentsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (structureIds.length > 0) {
    assignmentWhere.fee_structure_id = { in: structureIds };
  } else if (filters.term_id || filters.academic_year_id) {
    return {
      collected: "0.00",
      outstanding: "0.00",
      overdue: "0.00",
      total_assigned: "0.00",
      assignment_count: 0
    };
  }

  const assignments = await prisma.student_fee_assignments.findMany({
    where: assignmentWhere
  });

  const collected = assignments.reduce((sum, a) => sum + Number(a.amount_paid), 0);
  const outstanding = assignments.reduce((sum, a) => sum + Number(a.balance), 0);
  const overdue = assignments
    .filter((a) => a.status === FeeAssignmentStatus.overdue)
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const totalAssigned = assignments.reduce(
    (sum, a) => sum + Number(a.amount_due),
    0
  );

  return {
    collected: collected.toFixed(2),
    outstanding: outstanding.toFixed(2),
    overdue: overdue.toFixed(2),
    total_assigned: totalAssigned.toFixed(2),
    assignment_count: assignments.length
  };
};

export const findAllTransactions = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: TransactionFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.fee_transactionsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.fee_assignment_id) {
    where.fee_assignment_id = toBigInt(filters.fee_assignment_id);
  }

  if (filters.from_date || filters.to_date) {
    where.paid_at = {};
    if (filters.from_date) {
      where.paid_at.gte = toDateValue(filters.from_date);
    }
    if (filters.to_date) {
      where.paid_at.lte = toDateValue(filters.to_date);
    }
  }

  const orderBy: Prisma.fee_transactionsOrderByWithRelationInput =
    sort === "paid_at"
      ? { paid_at: order ?? "desc" }
      : { created_at: order ?? "desc" };

  const [items, total] = await prisma.$transaction([
    prisma.fee_transactions.findMany({
      where,
      orderBy,
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
        }
      }
    }),
    prisma.fee_transactions.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatTransaction(item),
      student: item.student
        ? { ...item.student, id: item.student.id.toString() }
        : null
    })),
    meta: { page, limit, total }
  };
};

export const findTransactionById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid transaction id", 400);
  }

  const record = await prisma.fee_transactions.findFirst({
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
      fee_assignment: true
    }
  });

  if (!record) {
    throw new AppError("not_found", "Fee transaction not found", 404);
  }

  return {
    ...formatTransaction(record),
    student: record.student
      ? { ...record.student, id: record.student.id.toString() }
      : null,
    fee_assignment: record.fee_assignment
      ? {
          id: record.fee_assignment.id.toString(),
          amount_due: record.fee_assignment.amount_due.toString(),
          balance: record.fee_assignment.balance.toString(),
          status: record.fee_assignment.status
        }
      : null
  };
};

export const updateTransaction = async (
  schoolId: string | number | bigint,
  id: string,
  input: TransactionUpdateInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid transaction id", 400);
  }

  const existing = await prisma.fee_transactions.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Fee transaction not found", 404);
  }

  const updated = await prisma.fee_transactions.update({
    where: { id: existing.id },
    data: {
      payment_ref: input.payment_ref,
      notes: input.notes
    }
  });

  return formatTransaction(updated);
};

export const deleteTransaction = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid transaction id", 400);
    }

    const existing = await tx.fee_transactions.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Fee transaction not found", 404);
    }

    if (existing.fee_assignment_id) {
      const assignment = await tx.student_fee_assignments.findUnique({
        where: { id: existing.fee_assignment_id }
      });

      if (assignment) {
        const newPaid = Math.max(
          0,
          Number(assignment.amount_paid) - Number(existing.amount)
        );
        const newBalance = Number(assignment.amount_due) - newPaid;
        const status = resolveAssignmentStatusAfterPayment(
          assignment.amount_due,
          { toString: () => newPaid.toFixed(2) } as Prisma.Decimal,
          assignment.due_date
        );

        await tx.student_fee_assignments.update({
          where: { id: assignment.id },
          data: {
            amount_paid: newPaid.toFixed(2),
            balance: Math.max(newBalance, 0).toFixed(2),
            status
          }
        });
      }
    }

    await tx.fee_transactions.delete({ where: { id: existing.id } });

    return formatTransaction(existing);
  });

export const attachReceiptToTransaction = async (
  schoolId: string | number | bigint,
  id: string,
  receiptUrl: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid transaction id", 400);
  }

  const existing = await prisma.fee_transactions.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Fee transaction not found", 404);
  }

  const updated = await prisma.fee_transactions.update({
    where: { id: existing.id },
    data: { receipt_url: receiptUrl }
  });

  return formatTransaction(updated);
};
