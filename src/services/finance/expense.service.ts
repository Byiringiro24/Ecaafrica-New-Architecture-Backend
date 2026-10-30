import type { ExpenseStatus, PaymentMethod, Prisma, expenses } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AuditActorType } from "../../constants/enums";
import type { PaginationParams } from "../../helpers/pagination";
import { AppError } from "../../middleware/errorHandler";
import { logAction } from "../audit.service";
import {
  dateRangeFilter,
  parseId,
  resolveOrderBy,
  toAuditJson,
  toBigInt,
  toDate,
  toDecimal,
  type IdInput
} from "./shared";

export const EXPENSE_CATEGORIES = [
  "Utilities",
  "Internet",
  "Fuel",
  "Maintenance",
  "Office Supplies",
  "Cleaning",
  "Marketing",
  "Transport",
  "Repairs",
  "Miscellaneous"
];

export const findExpenseCategories = async (schoolId: IdInput) => {
  const custom = await prisma.expense_categories.findMany({
    where: { school_id: toBigInt(schoolId), is_active: true },
    orderBy: { name: "asc" },
    select: { name: true }
  });
  return Array.from(new Set([...EXPENSE_CATEGORIES, ...custom.map((category) => category.name)]));
};

export const createExpenseCategory = async (schoolId: IdInput, name: string) => {
  const normalized = name.trim();
  const existing = await prisma.expense_categories.findFirst({
    where: { school_id: toBigInt(schoolId), name: { equals: normalized, mode: "insensitive" } }
  });
  if (existing || EXPENSE_CATEGORIES.some((category) => category.toLowerCase() === normalized.toLowerCase())) {
    throw new AppError("conflict", "An expense category with this name already exists", 409);
  }

  const created = await prisma.expense_categories.create({
    data: { school_id: toBigInt(schoolId), name: normalized }
  });
  return { id: created.id.toString(), school_id: created.school_id.toString(), name: created.name };
};

type ExpenseCreateInput = {
  expense_date: string | Date;
  category: string;
  description: string;
  vendor?: string;
  amount: string | number;
  currency?: string;
  document_url?: string;
};

type ExpenseUpdateInput = Partial<ExpenseCreateInput>;

type ExpenseFilters = {
  status?: ExpenseStatus;
  category?: string;
  vendor?: string;
  from_date?: string;
  to_date?: string;
};

const format = (record: expenses & { approver?: { name: string } | null }) => ({
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  reference: record.reference,
  expense_date: record.expense_date,
  category: record.category,
  description: record.description,
  vendor: record.vendor,
  amount: record.amount.toString(),
  currency: record.currency,
  document_url: record.document_url,
  status: record.status,
  approved_by: record.approved_by ? record.approved_by.toString() : null,
  approved_by_name: record.approver?.name ?? null,
  approved_at: record.approved_at,
  rejection_reason: record.rejection_reason,
  paid_at: record.paid_at,
  payment_method: record.payment_method,
  created_by: record.created_by ? record.created_by.toString() : null,
  created_at: record.created_at,
  updated_at: record.updated_at
});

const buildWhere = (schoolId: IdInput, filters: ExpenseFilters, q?: string) => {
  const where: Prisma.expensesWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null
  };

  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.vendor) where.vendor = { contains: filters.vendor, mode: "insensitive" };

  const range = dateRangeFilter(filters.from_date, filters.to_date);
  if (range) where.expense_date = range;

  if (q) {
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { vendor: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } }
    ];
  }

  return where;
};

export const createExpense = async (
  schoolId: IdInput,
  createdBy: IdInput | undefined,
  input: ExpenseCreateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const year = toDate(input.expense_date).getFullYear();
    const count = await tx.expenses.count({
      where: { school_id: toBigInt(schoolId), reference: { startsWith: `EXP-${year}-` } }
    });

    const created = await tx.expenses.create({
      data: {
        school_id: toBigInt(schoolId),
        reference: `EXP-${year}-${String(count + 1).padStart(4, "0")}`,
        expense_date: toDate(input.expense_date),
        category: input.category,
        description: input.description,
        vendor: input.vendor,
        amount: toDecimal(input.amount),
        currency: input.currency ?? "RWF",
        document_url: input.document_url,
        created_by: createdBy ? toBigInt(createdBy) : undefined
      }
    });

    return format(created);
  });

  void logAction(
    createdBy ?? null,
    AuditActorType.SCHOOL_USER,
    "create",
    "expenses",
    result.id,
    { schoolId, resourceName: result.reference, newValues: toAuditJson({ ...input }) }
  );

  return result;
};

export const findAllExpenses = async (
  schoolId: IdInput,
  pagination: PaginationParams,
  filters: ExpenseFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where = buildWhere(schoolId, filters, q);

  const [items, total, totals] = await Promise.all([
    prisma.expenses.findMany({
      where,
      orderBy: resolveOrderBy<Prisma.expensesOrderByWithRelationInput>(
        ["expense_date", "amount", "created_at", "category", "status"],
        sort,
        order,
        "expense_date"
      ),
      skip: (page - 1) * limit,
      take: limit,
      include: { approver: { select: { name: true } } }
    }),
    prisma.expenses.count({ where }),
    prisma.expenses.groupBy({
      by: ["status"],
      where,
      _sum: { amount: true },
      orderBy: { status: "asc" }
    })
  ]);

  const sumFor = (status: ExpenseStatus) =>
    totals.find((t) => t.status === status)?._sum?.amount?.toString() ?? "0";

  return {
    data: items.map(format),
    meta: {
      page,
      limit,
      total,
      totals: {
        pending: sumFor("pending"),
        approved: sumFor("approved"),
        paid: sumFor("paid"),
        rejected: sumFor("rejected"),
        all: totals
          .reduce((acc, t) => acc + Number(t._sum?.amount ?? 0), 0)
          .toString()
      }
    }
  };
};

export const findExpenseById = async (schoolId: IdInput, id: string) => {
  const record = await prisma.expenses.findFirst({
    where: { id: parseId(id, "expense"), school_id: toBigInt(schoolId), deleted_at: null },
    include: { approver: { select: { name: true } } }
  });

  if (!record) {
    throw new AppError("not_found", "Expense not found", 404);
  }

  return format(record);
};

const loadEditable = async (
  tx: Prisma.TransactionClient,
  schoolId: IdInput,
  id: string
) => {
  const existing = await tx.expenses.findFirst({
    where: { id: parseId(id, "expense"), school_id: toBigInt(schoolId), deleted_at: null }
  });

  if (!existing) {
    throw new AppError("not_found", "Expense not found", 404);
  }

  return existing;
};

export const updateExpense = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: ExpenseUpdateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await loadEditable(tx, schoolId, id);

    if (existing.status !== "pending") {
      throw new AppError(
        "conflict",
        "Only pending expenses can be edited",
        409
      );
    }

    const data: Prisma.expensesUncheckedUpdateInput = {};
    if (input.expense_date !== undefined) data.expense_date = toDate(input.expense_date);
    if (input.category !== undefined) data.category = input.category;
    if (input.description !== undefined) data.description = input.description;
    if (input.vendor !== undefined) data.vendor = input.vendor;
    if (input.amount !== undefined) data.amount = toDecimal(input.amount);
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.document_url !== undefined) data.document_url = input.document_url;

    const updated = await tx.expenses.update({ where: { id: existing.id }, data });
    return format(updated);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "update", "expenses", result.id, {
    schoolId,
    resourceName: result.reference,
    newValues: toAuditJson({ ...input })
  });

  return result;
};

export const approveExpense = async (
  schoolId: IdInput,
  id: string,
  approvedBy: IdInput | undefined
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await loadEditable(tx, schoolId, id);

    if (existing.status !== "pending") {
      throw new AppError(
        "conflict",
        `Cannot approve an expense with status "${existing.status}"`,
        409
      );
    }

    const updated = await tx.expenses.update({
      where: { id: existing.id },
      data: {
        status: "approved",
        approved_by: approvedBy ? toBigInt(approvedBy) : undefined,
        approved_at: new Date(),
        rejection_reason: null
      },
      include: { approver: { select: { name: true } } }
    });

    return format(updated);
  });

  void logAction(
    approvedBy ?? null,
    AuditActorType.SCHOOL_USER,
    "approve",
    "expenses",
    result.id,
    { schoolId, resourceName: result.reference }
  );

  return result;
};

export const rejectExpense = async (
  schoolId: IdInput,
  id: string,
  rejectedBy: IdInput | undefined,
  reason: string
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await loadEditable(tx, schoolId, id);

    if (existing.status !== "pending") {
      throw new AppError(
        "conflict",
        `Cannot reject an expense with status "${existing.status}"`,
        409
      );
    }

    const updated = await tx.expenses.update({
      where: { id: existing.id },
      data: {
        status: "rejected",
        approved_by: rejectedBy ? toBigInt(rejectedBy) : undefined,
        approved_at: new Date(),
        rejection_reason: reason
      },
      include: { approver: { select: { name: true } } }
    });

    return format(updated);
  });

  void logAction(
    rejectedBy ?? null,
    AuditActorType.SCHOOL_USER,
    "reject",
    "expenses",
    result.id,
    { schoolId, resourceName: result.reference, newValues: toAuditJson({ reason }) }
  );

  return result;
};

export const markExpensePaid = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: { payment_method?: PaymentMethod; paid_at?: string | Date }
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await loadEditable(tx, schoolId, id);

    if (existing.status !== "approved") {
      throw new AppError(
        "conflict",
        "Only approved expenses can be marked as paid",
        409
      );
    }

    const updated = await tx.expenses.update({
      where: { id: existing.id },
      data: {
        status: "paid",
        paid_at: input.paid_at ? toDate(input.paid_at) : new Date(),
        payment_method: input.payment_method
      },
      include: { approver: { select: { name: true } } }
    });

    return format(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "mark_paid",
    "expenses",
    result.id,
    { schoolId, resourceName: result.reference }
  );

  return result;
};

export const deleteExpense = async (
  schoolId: IdInput,
  id: string,
  actorId?: IdInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await loadEditable(tx, schoolId, id);

    if (existing.status === "paid") {
      throw new AppError("conflict", "Cannot delete a paid expense", 409);
    }

    const deleted = await tx.expenses.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return format(deleted);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "delete", "expenses", result.id, {
    schoolId,
    resourceName: result.reference
  });

  return result;
};

export const attachExpenseDocument = async (
  schoolId: IdInput,
  id: string,
  documentUrl: string
) => {
  const existing = await prisma.expenses.findFirst({
    where: { id: parseId(id, "expense"), school_id: toBigInt(schoolId), deleted_at: null }
  });

  if (!existing) {
    throw new AppError("not_found", "Expense not found", 404);
  }

  const updated = await prisma.expenses.update({
    where: { id: existing.id },
    data: { document_url: documentUrl }
  });

  return format(updated);
};
