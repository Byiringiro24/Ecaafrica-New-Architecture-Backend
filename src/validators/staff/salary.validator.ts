import { SalaryStatus } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);

export const salaryRecordIdParamSchema = z.object({
  id: z.string().min(1)
});

const createSalaryBodySchema = z.object({
  staff_id: idInput,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  basic_salary: z.union([z.string(), z.number()]),
  allowances: z.union([z.string(), z.number()]).optional(),
  deductions: z.union([z.string(), z.number()]).optional(),
  net_salary: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional()
});

const updateSalaryBodySchema = z
  .object({
    basic_salary: z.union([z.string(), z.number()]).optional(),
    allowances: z.union([z.string(), z.number()]).optional(),
    deductions: z.union([z.string(), z.number()]).optional(),
    net_salary: z.union([z.string(), z.number()]).optional(),
    status: z.nativeEnum(SalaryStatus).optional(),
    payment_method: z.string().max(50).nullable().optional(),
    notes: z.string().nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const markPaidBodySchema = z.object({
  payment_method: z.string().max(50).optional(),
  paid_at: z.union([z.string(), z.date()]).optional()
});

const listSalaryQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  staff_id: z.string().optional(),
  month: z.string().optional(),
  year: z.string().optional(),
  status: z.nativeEnum(SalaryStatus).optional()
});

export const createSalarySchema = z.object({
  body: createSalaryBodySchema
});

export const updateSalarySchema = z.object({
  params: salaryRecordIdParamSchema,
  body: updateSalaryBodySchema
});

export const markSalaryPaidSchema = z.object({
  params: salaryRecordIdParamSchema,
  body: markPaidBodySchema.optional()
});

export const listSalarySchema = z.object({
  query: listSalaryQuerySchema
});
