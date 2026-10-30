import type { InvoiceStatus, Prisma, invoice_line_items, invoices } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { PaginationParams } from "../../helpers/pagination";

type InvoiceLineItemInput = {
  description: string;
  quantity?: number | string;
  unit_price: number | string;
  total?: number | string;
  sort_order?: number;
};

type InvoiceCreateInput = {
  invoice_number: string;
  school_id: string | number | bigint;
  subscription_id?: string | number | bigint | null;
  period_start: string | Date;
  period_end: string | Date;
  issue_date: string | Date;
  due_date: string | Date;
  subtotal?: number | string;
  tax_rate?: number | string;
  tax_amount?: number | string;
  discount_amount?: number | string;
  total?: number | string;
  currency?: string;
  status?: string;
  paid_at?: string | Date | null;
  payment_method?: string | null;
  payment_ref?: string | null;
  notes?: string | null;
  pdf_url?: string | null;
  created_by?: string | number | bigint | null;
  line_items: InvoiceLineItemInput[];
};

type InvoiceUpdateInput = Partial<Omit<InvoiceCreateInput, "invoice_number">> & {
  invoice_number?: string;
  line_items?: InvoiceLineItemInput[];
};

type InvoiceFilters = {
  status?: string;
  school_id?: string;
  subscription_id?: string;
};

type InvoiceRecord = invoices & { line_items?: invoice_line_items[] };

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value);
};

const toDateValue = (value: string | Date | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

const parseAmount = (value: number | string | undefined | null, fallback = 0) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLineItems = (items: InvoiceLineItemInput[]) =>
  items.map((item, index) => {
    const quantity = parseAmount(item.quantity, 1);
    const unitPrice = parseAmount(item.unit_price, 0);
    const computedTotal = quantity * unitPrice;
    const total =
      item.total !== undefined && item.total !== null
        ? parseAmount(item.total, computedTotal)
        : computedTotal;

    return {
      description: item.description,
      quantity,
      unit_price: unitPrice,
      total,
      sort_order: item.sort_order ?? index
    };
  });

const computeTotals = (
  input: Pick<InvoiceCreateInput, "subtotal" | "tax_rate" | "tax_amount" | "discount_amount" | "total">,
  lineItems: ReturnType<typeof normalizeLineItems>
) => {
  const subtotal =
    input.subtotal !== undefined && input.subtotal !== null
      ? parseAmount(input.subtotal, 0)
      : lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = parseAmount(input.tax_rate, 0);
  const taxAmount =
    input.tax_amount !== undefined && input.tax_amount !== null
      ? parseAmount(input.tax_amount, 0)
      : subtotal * (taxRate / 100);
  const discountAmount = parseAmount(input.discount_amount, 0);
  const total =
    input.total !== undefined && input.total !== null
      ? parseAmount(input.total, 0)
      : subtotal + taxAmount - discountAmount;

  return {
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total
  };
};

const formatInvoice = (invoice: InvoiceRecord) => ({
  ...invoice,
  id: invoice.id.toString(),
  school_id: invoice.school_id.toString(),
  subscription_id: invoice.subscription_id ? invoice.subscription_id.toString() : null,
  created_by: invoice.created_by ? invoice.created_by.toString() : null,
  line_items: invoice.line_items?.map((item) => ({
    ...item,
    id: item.id.toString(),
    invoice_id: item.invoice_id.toString()
  }))
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "issue_date", "due_date", "status"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.invoicesOrderByWithRelationInput;
  }

  return { issue_date: "desc" } as Prisma.invoicesOrderByWithRelationInput;
};

export const createInvoice = async (input: InvoiceCreateInput) => {
  const lineItems = normalizeLineItems(input.line_items ?? []);
  const totals = computeTotals(input, lineItems);

  const created = await prisma.invoices.create({
    data: {
      invoice_number: input.invoice_number,
      school_id: toBigInt(input.school_id),
      subscription_id:
        input.subscription_id !== undefined && input.subscription_id !== null
          ? toBigInt(input.subscription_id)
          : undefined,
      period_start: toDateValue(input.period_start) as Date,
      period_end: toDateValue(input.period_end) as Date,
      issue_date: toDateValue(input.issue_date) as Date,
      due_date: toDateValue(input.due_date) as Date,
      subtotal: totals.subtotal,
      tax_rate: totals.tax_rate,
      tax_amount: totals.tax_amount,
      discount_amount: totals.discount_amount,
      total: totals.total,
      currency: input.currency ?? undefined,
      status: (input.status as InvoiceStatus) ?? undefined,
      paid_at: toDateValue(input.paid_at) ?? undefined,
      payment_method: input.payment_method ?? undefined,
      payment_ref: input.payment_ref ?? undefined,
      notes: input.notes ?? undefined,
      pdf_url: input.pdf_url ?? undefined,
      created_by:
        input.created_by !== undefined && input.created_by !== null
          ? toBigInt(input.created_by)
          : undefined,
      line_items: {
        create: lineItems
      }
    },
    include: { line_items: true }
  });

  return formatInvoice(created);
};

export const findAllInvoices = async (
  pagination: PaginationParams,
  filters: InvoiceFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.invoicesWhereInput = {};

  if (filters.status) where.status = filters.status as InvoiceStatus;
  if (filters.school_id) where.school_id = toBigInt(filters.school_id);
  if (filters.subscription_id) where.subscription_id = toBigInt(filters.subscription_id);

  if (q) {
    where.OR = [
      { invoice_number: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.invoices.findMany({
      where,
      include: { line_items: true },
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.invoices.count({ where })
  ]);

  return {
    data: items.map((item) => formatInvoice(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findInvoiceById = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid invoice id", 400);
  }

  const invoice = await prisma.invoices.findFirst({
    where: { id: toBigInt(id) },
    include: { line_items: true }
  });

  if (!invoice) {
    throw new AppError("not_found", "Invoice not found", 404);
  }

  return formatInvoice(invoice);
};

export const updateInvoice = async (id: string, input: InvoiceUpdateInput) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid invoice id", 400);
  }

  const existing = await prisma.invoices.findFirst({
    where: { id: toBigInt(id) },
    include: { line_items: true }
  });

  if (!existing) {
    throw new AppError("not_found", "Invoice not found", 404);
  }

  const shouldUpdateLineItems = Array.isArray(input.line_items);
  const lineItems = shouldUpdateLineItems
    ? normalizeLineItems(input.line_items ?? [])
    : [];
  const totals = shouldUpdateLineItems
    ? computeTotals(
        {
          subtotal: input.subtotal,
          tax_rate: input.tax_rate,
          tax_amount: input.tax_amount,
          discount_amount: input.discount_amount,
          total: input.total
        },
        lineItems
      )
    : undefined;

  const updated = await prisma.invoices.update({
    where: { id: existing.id },
    data: {
      invoice_number: input.invoice_number ?? undefined,
      school_id: input.school_id ? toBigInt(input.school_id) : undefined,
      subscription_id:
        input.subscription_id !== undefined
          ? input.subscription_id === null
            ? null
            : toBigInt(input.subscription_id)
          : undefined,
      period_start: input.period_start ? (toDateValue(input.period_start) as Date) : undefined,
      period_end: input.period_end ? (toDateValue(input.period_end) as Date) : undefined,
      issue_date: input.issue_date ? (toDateValue(input.issue_date) as Date) : undefined,
      due_date: input.due_date ? (toDateValue(input.due_date) as Date) : undefined,
      subtotal: totals ? totals.subtotal : input.subtotal ?? undefined,
      tax_rate: totals ? totals.tax_rate : input.tax_rate ?? undefined,
      tax_amount: totals ? totals.tax_amount : input.tax_amount ?? undefined,
      discount_amount: totals ? totals.discount_amount : input.discount_amount ?? undefined,
      total: totals ? totals.total : input.total ?? undefined,
      currency: input.currency ?? undefined,
      status: input.status ? (input.status as InvoiceStatus) : undefined,
      paid_at: toDateValue(input.paid_at),
      payment_method: input.payment_method ?? undefined,
      payment_ref: input.payment_ref ?? undefined,
      notes: input.notes ?? undefined,
      pdf_url: input.pdf_url ?? undefined,
      created_by:
        input.created_by !== undefined && input.created_by !== null
          ? toBigInt(input.created_by)
          : undefined,
      line_items: shouldUpdateLineItems
        ? {
            deleteMany: {},
            create: lineItems
          }
        : undefined
    },
    include: { line_items: true }
  });

  return formatInvoice(updated);
};

export const deleteInvoice = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid invoice id", 400);
  }

  const existing = await prisma.invoices.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Invoice not found", 404);
  }

  const deleted = await prisma.invoices.delete({
    where: { id: existing.id },
    include: { line_items: true }
  });

  return formatInvoice(deleted);
};

export const getRevenueSummary = async () => {
  const totalsByStatus = await prisma.invoices.groupBy({
    by: ["status"],
    _sum: { total: true },
    _count: { _all: true }
  });

  const monthly = await prisma.$queryRaw<
    { month: string; total: Prisma.Decimal; count: bigint }[]
  >`
    SELECT
      to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
      COALESCE(SUM(total), 0) AS total,
      COUNT(*)::bigint AS count
    FROM invoices
    WHERE status = 'paid' AND paid_at IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  `;

  return {
    totals_by_status: totalsByStatus.map((row) => ({
      status: row.status,
      total: row._sum.total ? row._sum.total.toString() : "0",
      count: row._count._all
    })),
    monthly: monthly.map((row) => ({
      month: row.month,
      total: row.total.toString(),
      count: row.count.toString()
    }))
  };
};
