import type { PaymentMethod, Prisma, StudentInvoiceStatus } from "@prisma/client";
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

type InvoiceCreateInput = {
  student_id: IdInput;
  academic_year_id?: IdInput;
  term_id?: IdInput;
  issue_date?: string | Date;
  due_date: string | Date;
  items: { label: string; amount: string | number; fee_structure_id?: IdInput }[];
  discount?: string | number;
  previous_balance?: string | number;
  late_charges?: string | number;
  currency?: string;
  notes?: string;
  status?: Extract<StudentInvoiceStatus, "draft" | "pending">;
};

type InvoiceUpdateInput = Partial<
  Omit<InvoiceCreateInput, "student_id" | "status">
>;

type InvoiceFilters = {
  status?: StudentInvoiceStatus;
  student_id?: string;
  term_id?: string;
  academic_year_id?: string;
  from_date?: string;
  to_date?: string;
};

type InvoiceRecord = Prisma.student_invoicesGetPayload<{
  include: {
    items: true;
    student: {
      select: {
        id: true;
        first_name: true;
        last_name: true;
        student_id_number: true;
      };
    };
    term: { select: { id: true; name: true } };
    academic_year: { select: { id: true; name: true } };
  };
}>;

const invoiceInclude = {
  items: true,
  student: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      student_id_number: true
    }
  },
  term: { select: { id: true, name: true } },
  academic_year: { select: { id: true, name: true } }
} satisfies Prisma.student_invoicesInclude;

const format = (record: InvoiceRecord) => ({
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  invoice_number: record.invoice_number,
  student_id: record.student_id.toString(),
  student_name: `${record.student.first_name} ${record.student.last_name}`,
  student_number: record.student.student_id_number,
  academic_year_id: record.academic_year_id ? record.academic_year_id.toString() : null,
  academic_year: record.academic_year?.name ?? null,
  term_id: record.term_id ? record.term_id.toString() : null,
  term: record.term?.name ?? null,
  issue_date: record.issue_date,
  due_date: record.due_date,
  items: record.items.map((item) => ({
    id: item.id.toString(),
    label: item.label,
    amount: item.amount.toString(),
    fee_structure_id: item.fee_structure_id ? item.fee_structure_id.toString() : null
  })),
  subtotal: record.subtotal.toString(),
  discount: record.discount.toString(),
  previous_balance: record.previous_balance.toString(),
  late_charges: record.late_charges.toString(),
  total: record.total.toString(),
  amount_paid: record.amount_paid.toString(),
  payment_date: record.payment_date,
  payment_method: record.payment_method,
  balance: record.total.sub(record.amount_paid).toString(),
  currency: record.currency,
  status: record.status,
  document_url: record.document_url,
  notes: record.notes,
  created_at: record.created_at,
  updated_at: record.updated_at
});

/** total = subtotal - discount + previous_balance + late_charges, floored at zero. */
const computeTotals = (input: {
  items: { amount: string | number }[];
  discount?: string | number;
  previous_balance?: string | number;
  late_charges?: string | number;
}) => {
  const subtotal = input.items.reduce((sum, i) => sum + Number(i.amount), 0);
  const discount = Number(input.discount ?? 0);
  const previousBalance = Number(input.previous_balance ?? 0);
  const lateCharges = Number(input.late_charges ?? 0);

  if (discount > subtotal + previousBalance + lateCharges) {
    throw new AppError(
      "bad_request",
      "Discount cannot exceed the invoice amount",
      400
    );
  }

  return {
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    previous_balance: previousBalance.toFixed(2),
    late_charges: lateCharges.toFixed(2),
    total: Math.max(0, subtotal - discount + previousBalance + lateCharges).toFixed(2)
  };
};

/**
 * Payment status is always derived from amount_paid vs total; it is never set
 * directly by a client. draft / cancelled / refunded are lifecycle states that
 * this derivation must not overwrite.
 */
const deriveStatus = (
  current: StudentInvoiceStatus,
  total: number,
  paid: number
): StudentInvoiceStatus => {
  if (current === "draft" || current === "cancelled" || current === "refunded") {
    return current;
  }

  if (paid <= 0) return "pending";
  if (paid >= total) return "paid";
  return "partially_paid";
};

const assertStudent = async (
  tx: Prisma.TransactionClient,
  schoolId: IdInput,
  studentId: IdInput
) => {
  const student = await tx.students.findFirst({
    where: { id: toBigInt(studentId), school_id: toBigInt(schoolId), deleted_at: null }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  return student;
};

export const createInvoice = async (
  schoolId: IdInput,
  createdBy: IdInput | undefined,
  input: InvoiceCreateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    await assertStudent(tx, schoolId, input.student_id);

    if (input.term_id) {
      const term = await tx.terms.findFirst({
        where: { id: toBigInt(input.term_id), school_id: toBigInt(schoolId), deleted_at: null }
      });

      if (!term) {
        throw new AppError("not_found", "Term not found", 404);
      }
    }

    const totals = computeTotals(input);
    const issueDate = input.issue_date ? toDate(input.issue_date) : new Date();
    const dueDate = toDate(input.due_date);

    if (dueDate < issueDate) {
      throw new AppError("bad_request", "Due date cannot precede the issue date", 400);
    }

    const year = issueDate.getFullYear();
    const count = await tx.student_invoices.count({
      where: {
        school_id: toBigInt(schoolId),
        invoice_number: { startsWith: `INV-${year}-` }
      }
    });

    const created = await tx.student_invoices.create({
      data: {
        school_id: toBigInt(schoolId),
        invoice_number: `INV-${year}-${String(count + 1).padStart(4, "0")}`,
        student_id: toBigInt(input.student_id),
        academic_year_id: input.academic_year_id
          ? toBigInt(input.academic_year_id)
          : undefined,
        term_id: input.term_id ? toBigInt(input.term_id) : undefined,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: totals.subtotal,
        discount: totals.discount,
        previous_balance: totals.previous_balance,
        late_charges: totals.late_charges,
        total: totals.total,
        currency: input.currency ?? "RWF",
        status: input.status ?? "pending",
        notes: input.notes,
        created_by: createdBy ? toBigInt(createdBy) : undefined,
        items: {
          create: input.items.map((item) => ({
            label: item.label,
            amount: toDecimal(item.amount),
            fee_structure_id: item.fee_structure_id
              ? toBigInt(item.fee_structure_id)
              : undefined
          }))
        }
      },
      include: invoiceInclude
    });

    return format(created);
  });

  void logAction(
    createdBy ?? null,
    AuditActorType.SCHOOL_USER,
    "create",
    "student_invoices",
    result.id,
    {
      schoolId,
      resourceName: result.invoice_number,
      newValues: toAuditJson({ student_id: result.student_id, total: result.total })
    }
  );

  return result;
};

export const findAllInvoices = async (
  schoolId: IdInput,
  pagination: PaginationParams,
  filters: InvoiceFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.student_invoicesWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null
  };

  if (filters.status) where.status = filters.status;
  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.term_id) where.term_id = toBigInt(filters.term_id);
  if (filters.academic_year_id) {
    where.academic_year_id = toBigInt(filters.academic_year_id);
  }

  const range = dateRangeFilter(filters.from_date, filters.to_date);
  if (range) where.issue_date = range;

  if (q) {
    const numericSchoolId = /^\d+$/.test(q) ? BigInt(q) : undefined;
    where.OR = [
      { invoice_number: { contains: q, mode: "insensitive" } },
      { student: { first_name: { contains: q, mode: "insensitive" } } },
      { student: { last_name: { contains: q, mode: "insensitive" } } },
      { student: { student_id_number: { contains: q, mode: "insensitive" } } },
      ...(numericSchoolId !== undefined ? [{ student: { student_school_id: numericSchoolId } }] : [])
    ];
  }

  const [items, total, sums] = await Promise.all([
    prisma.student_invoices.findMany({
      where,
      orderBy: resolveOrderBy<Prisma.student_invoicesOrderByWithRelationInput>(
        ["issue_date", "due_date", "total", "created_at", "status"],
        sort,
        order,
        "issue_date"
      ),
      skip: (page - 1) * limit,
      take: limit,
      include: invoiceInclude
    }),
    prisma.student_invoices.count({ where }),
    prisma.student_invoices.aggregate({
      where,
      _sum: { total: true, amount_paid: true }
    })
  ]);

  const billed = Number(sums._sum.total ?? 0);
  const paid = Number(sums._sum.amount_paid ?? 0);

  return {
    data: items.map(format),
    meta: {
      page,
      limit,
      total,
      total_billed: billed.toFixed(2),
      total_paid: paid.toFixed(2),
      total_outstanding: (billed - paid).toFixed(2)
    }
  };
};

export const findInvoiceById = async (schoolId: IdInput, id: string) => {
  const record = await prisma.student_invoices.findFirst({
    where: { id: parseId(id, "invoice"), school_id: toBigInt(schoolId), deleted_at: null },
    include: invoiceInclude
  });

  if (!record) {
    throw new AppError("not_found", "Invoice not found", 404);
  }

  return format(record);
};

export const updateInvoice = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: InvoiceUpdateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.student_invoices.findFirst({
      where: { id: parseId(id, "invoice"), school_id: toBigInt(schoolId), deleted_at: null },
      include: { items: true }
    });

    if (!existing) {
      throw new AppError("not_found", "Invoice not found", 404);
    }

    if (existing.status === "cancelled" || existing.status === "refunded") {
      throw new AppError(
        "conflict",
        `Cannot edit a ${existing.status} invoice`,
        409
      );
    }

    if (Number(existing.amount_paid) > 0 && input.items) {
      throw new AppError(
        "conflict",
        "Cannot change line items on an invoice that has payments",
        409
      );
    }

    const items =
      input.items ??
      existing.items.map((i) => ({ label: i.label, amount: i.amount.toString() }));

    const totals = computeTotals({
      items,
      discount: input.discount ?? existing.discount.toString(),
      previous_balance: input.previous_balance ?? existing.previous_balance.toString(),
      late_charges: input.late_charges ?? existing.late_charges.toString()
    });

    const data: Prisma.student_invoicesUncheckedUpdateInput = {
      subtotal: totals.subtotal,
      discount: totals.discount,
      previous_balance: totals.previous_balance,
      late_charges: totals.late_charges,
      total: totals.total,
      status: deriveStatus(
        existing.status,
        Number(totals.total),
        Number(existing.amount_paid)
      )
    };

    if (input.issue_date !== undefined) data.issue_date = toDate(input.issue_date);
    if (input.due_date !== undefined) data.due_date = toDate(input.due_date);
    if (input.term_id !== undefined) data.term_id = toBigInt(input.term_id);
    if (input.academic_year_id !== undefined) {
      data.academic_year_id = toBigInt(input.academic_year_id);
    }
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.notes !== undefined) data.notes = input.notes;

    if (input.items) {
      await tx.student_invoice_items.deleteMany({ where: { invoice_id: existing.id } });
      await tx.student_invoice_items.createMany({
        data: input.items.map((item) => ({
          invoice_id: existing.id,
          label: item.label,
          amount: toDecimal(item.amount),
          fee_structure_id: item.fee_structure_id
            ? toBigInt(item.fee_structure_id)
            : undefined
        }))
      });
    }

    const updated = await tx.student_invoices.update({
      where: { id: existing.id },
      data,
      include: invoiceInclude
    });

    return format(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "update",
    "student_invoices",
    result.id,
    { schoolId, resourceName: result.invoice_number, newValues: toAuditJson({ ...input }) }
  );

  return result;
};

export const issueInvoice = async (
  schoolId: IdInput,
  id: string,
  actorId?: IdInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.student_invoices.findFirst({
      where: { id: parseId(id, "invoice"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Invoice not found", 404);
    }

    if (existing.status !== "draft") {
      throw new AppError("conflict", "Only draft invoices can be issued", 409);
    }

    const updated = await tx.student_invoices.update({
      where: { id: existing.id },
      data: { status: "pending" },
      include: invoiceInclude
    });

    return format(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "issue",
    "student_invoices",
    result.id,
    { schoolId, resourceName: result.invoice_number }
  );

  return result;
};

export const recordInvoicePayment = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: { amount: string | number; payment_date?: string | Date; payment_method?: PaymentMethod }
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.student_invoices.findFirst({
      where: { id: parseId(id, "invoice"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Invoice not found", 404);
    }

    if (existing.status === "draft") {
      throw new AppError("conflict", "Issue the invoice before recording payment", 409);
    }

    if (existing.status === "cancelled" || existing.status === "refunded") {
      throw new AppError(
        "conflict",
        `Cannot record a payment against a ${existing.status} invoice`,
        409
      );
    }

    const total = Number(existing.total);
    const newPaid = Number(existing.amount_paid) + Number(input.amount);

    if (newPaid > total) {
      throw new AppError(
        "bad_request",
        "Payment exceeds the invoice balance",
        400
      );
    }

    const updated = await tx.student_invoices.update({
      where: { id: existing.id },
      data: {
        amount_paid: newPaid.toFixed(2),
        payment_date: input.payment_date ? toDate(input.payment_date) : new Date(),
        payment_method: input.payment_method ?? "cash",
        status: deriveStatus(existing.status, total, newPaid)
      },
      include: invoiceInclude
    });

    return format(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "record_payment",
    "student_invoices",
    result.id,
    { schoolId, resourceName: result.invoice_number, newValues: toAuditJson(input) }
  );

  return result;
};

export const cancelInvoice = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  reason?: string
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.student_invoices.findFirst({
      where: { id: parseId(id, "invoice"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Invoice not found", 404);
    }

    if (Number(existing.amount_paid) > 0) {
      throw new AppError(
        "conflict",
        "Cannot cancel an invoice that has payments; refund it instead",
        409
      );
    }

    if (existing.status === "cancelled") {
      throw new AppError("conflict", "Invoice is already cancelled", 409);
    }

    const updated = await tx.student_invoices.update({
      where: { id: existing.id },
      data: {
        status: "cancelled",
        notes: reason ? `${existing.notes ?? ""}\nCancelled: ${reason}`.trim() : existing.notes
      },
      include: invoiceInclude
    });

    return format(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "cancel",
    "student_invoices",
    result.id,
    { schoolId, resourceName: result.invoice_number, newValues: toAuditJson({ reason }) }
  );

  return result;
};

export const refundInvoice = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  reason?: string
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.student_invoices.findFirst({
      where: { id: parseId(id, "invoice"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Invoice not found", 404);
    }

    if (Number(existing.amount_paid) <= 0) {
      throw new AppError("conflict", "Only a paid invoice can be refunded", 409);
    }

    const updated = await tx.student_invoices.update({
      where: { id: existing.id },
      data: {
        status: "refunded",
        notes: reason ? `${existing.notes ?? ""}\nRefunded: ${reason}`.trim() : existing.notes
      },
      include: invoiceInclude
    });

    return format(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "refund",
    "student_invoices",
    result.id,
    { schoolId, resourceName: result.invoice_number, newValues: toAuditJson({ reason }) }
  );

  return result;
};

export const deleteInvoice = async (
  schoolId: IdInput,
  id: string,
  actorId?: IdInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.student_invoices.findFirst({
      where: { id: parseId(id, "invoice"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Invoice not found", 404);
    }

    if (Number(existing.amount_paid) > 0) {
      throw new AppError(
        "conflict",
        "Cannot delete an invoice that has payments",
        409
      );
    }

    const deleted = await tx.student_invoices.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() },
      include: invoiceInclude
    });

    return format(deleted);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "delete",
    "student_invoices",
    result.id,
    { schoolId, resourceName: result.invoice_number }
  );

  return result;
};

export const attachInvoiceDocument = async (
  schoolId: IdInput,
  id: string,
  documentUrl: string
) => {
  const existing = await prisma.student_invoices.findFirst({
    where: { id: parseId(id, "invoice"), school_id: toBigInt(schoolId), deleted_at: null }
  });

  if (!existing) {
    throw new AppError("not_found", "Invoice not found", 404);
  }

  const updated = await prisma.student_invoices.update({
    where: { id: existing.id },
    data: { document_url: documentUrl },
    include: invoiceInclude
  });

  return format(updated);
};
