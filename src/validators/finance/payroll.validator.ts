import { PaymentMethod, PayrollRunStatus } from "@prisma/client";
import { z } from "zod";

const amountInput = z.union([
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number"),
  z.number().nonnegative("Amount cannot be negative")
]);

const idInput = z.union([z.string().regex(/^\d+$/), z.number()]);
const dateInput = z.union([z.string().min(1), z.date()]);

export const payrollRunIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Invalid payroll run id")
});

export const payslipIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Invalid payslip id")
});

export const generatePayrollRunSchema = z.object({
  body: z.object({
    month: z.coerce.number().int().min(1, "Month must be 1-12").max(12, "Month must be 1-12"),
    year: z.coerce.number().int().min(2000).max(2100),
    notes: z.string().optional()
  })
});

export const listPayrollRunsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    status: z.nativeEnum(PayrollRunStatus).optional(),
    year: z.string().regex(/^\d{4}$/).optional()
  })
});

export const markPayrollRunPaidSchema = z.object({
  params: payrollRunIdParamSchema,
  body: z
    .object({ paid_at: dateInput.optional() })
    .optional()
    .default({})
});

const payslipBodySchema = z.object({
  staff_id: idInput,
  basic_salary: amountInput,
  allowances: amountInput.optional(),
  overtime: amountInput.optional(),
  bonus: amountInput.optional(),
  loan_recovery: amountInput.optional(),
  other_deductions: amountInput.optional(),
  notes: z.string().optional()
});

export const createPayslipSchema = z.object({
  params: payrollRunIdParamSchema,
  body: payslipBodySchema
});

export const updatePayslipSchema = z.object({
  params: payslipIdParamSchema,
  body: payslipBodySchema
    .omit({ staff_id: true })
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required"
    })
});

export const listPayslipsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    q: z.string().optional(),
    payroll_run_id: z.string().regex(/^\d+$/).optional(),
    staff_id: z.string().regex(/^\d+$/).optional(),
    status: z.nativeEnum(PayrollRunStatus).optional(),
    department: z.string().optional()
  })
});

export const markPayslipPaidSchema = z.object({
  params: payslipIdParamSchema,
  body: z
    .object({
      payment_method: z.nativeEnum(PaymentMethod).optional(),
      paid_at: dateInput.optional()
    })
    .optional()
    .default({})
});
