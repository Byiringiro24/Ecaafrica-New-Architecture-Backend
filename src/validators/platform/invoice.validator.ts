import { z } from "zod";
import { InvoiceStatus } from "@prisma/client";

const decimalSchema = z
  .union([z.number(), z.string()])
  .refine((value) => Number.isFinite(Number(value)), {
    message: "Invalid number"
  });

const dateInput = z.union([z.string(), z.date()]).nullable().optional();

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1)
});

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: decimalSchema.optional(),
  unit_price: decimalSchema,
  total: decimalSchema.optional(),
  sort_order: z.number().int().optional()
});

const createInvoiceBodySchema = z.object({
  invoice_number: z.string().min(1),
  school_id: z.union([z.string(), z.number()]),
  subscription_id: z.union([z.string(), z.number()]).nullable().optional(),
  period_start: z.union([z.string(), z.date()]),
  period_end: z.union([z.string(), z.date()]),
  issue_date: z.union([z.string(), z.date()]),
  due_date: z.union([z.string(), z.date()]),
  subtotal: decimalSchema.optional(),
  tax_rate: decimalSchema.optional(),
  tax_amount: decimalSchema.optional(),
  discount_amount: decimalSchema.optional(),
  total: decimalSchema.optional(),
  currency: z.string().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  paid_at: dateInput,
  payment_method: z.string().nullable().optional(),
  payment_ref: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  pdf_url: z.string().nullable().optional(),
  created_by: z.union([z.string(), z.number()]).nullable().optional(),
  line_items: z.array(lineItemSchema).min(1)
});

const updateInvoiceBodySchema = createInvoiceBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const listInvoicesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  school_id: z.string().optional(),
  subscription_id: z.string().optional()
});

export const createInvoiceSchema = z.object({
  body: createInvoiceBodySchema
});

export const updateInvoiceSchema = z.object({
  params: invoiceIdParamSchema,
  body: updateInvoiceBodySchema
});

export const listInvoicesSchema = z.object({
  query: listInvoicesQuerySchema
});
