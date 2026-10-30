import { ExpenseStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";

const amountInput = z.union([
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number"),
  z.number().positive("Amount must be greater than zero")
]);

const dateInput = z.union([z.string().min(1), z.date()]);

export const expenseIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Invalid expense id")
});

const createExpenseBodySchema = z.object({
  expense_date: dateInput,
  category: z.string().min(1, "Category is required").max(100),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().max(255).optional(),
  amount: amountInput,
  currency: z.string().length(3).optional(),
  document_url: z.string().max(500).optional()
});

const updateExpenseBodySchema = createExpenseBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listExpensesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  category: z.string().optional(),
  vendor: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional()
});

export const createExpenseSchema = z.object({ body: createExpenseBodySchema });

export const createExpenseCategorySchema = z.object({
  body: z.object({ name: z.string().trim().min(1, "Category name is required").max(100) })
});

export const updateExpenseSchema = z.object({
  params: expenseIdParamSchema,
  body: updateExpenseBodySchema
});

export const listExpensesSchema = z.object({ query: listExpensesQuerySchema });

export const rejectExpenseSchema = z.object({
  params: expenseIdParamSchema,
  body: z.object({
    reason: z.string().min(1, "Rejection reason is required")
  })
});

export const markExpensePaidSchema = z.object({
  params: expenseIdParamSchema,
  body: z
    .object({
      payment_method: z.nativeEnum(PaymentMethod).optional(),
      paid_at: dateInput.optional()
    })
    .optional()
    .default({})
});
