import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const feeTransactionIdParamSchema = z.object({
  id: z.string().min(1)
});

export const studentIdParamSchema = z.object({
  id: z.string().min(1)
});

const createFeeTransactionBodySchema = z.object({
  student_id: idInput,
  fee_assignment_id: idInput.optional(),
  amount: z.union([z.string(), z.number()]),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  payment_ref: z.string().max(100).optional(),
  paid_at: dateInput.optional(),
  notes: z.string().optional(),
  currency: z.string().length(3).optional()
});

const updateFeeTransactionBodySchema = z
  .object({
    payment_ref: z.string().max(100).optional(),
    notes: z.string().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listFeeTransactionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  student_id: z.string().optional(),
  fee_assignment_id: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional()
});

const feeSummaryQuerySchema = z.object({
  term_id: z.string().optional(),
  academic_year_id: z.string().optional()
});

export const createFeeTransactionSchema = z.object({
  body: createFeeTransactionBodySchema
});

export const updateFeeTransactionSchema = z.object({
  params: feeTransactionIdParamSchema,
  body: updateFeeTransactionBodySchema
});

export const listFeeTransactionsSchema = z.object({
  query: listFeeTransactionsQuerySchema
});

export const feeSummaryQuerySchemaExport = z.object({
  query: feeSummaryQuerySchema
});
