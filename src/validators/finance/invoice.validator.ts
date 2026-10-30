import { PaymentMethod, StudentInvoiceStatus } from "@prisma/client";
import { z } from "zod";

const amountInput = z.union([
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number"),
  z.number().nonnegative("Amount cannot be negative")
]);

const idInput = z.union([z.string().regex(/^\d+$/), z.number()]);
const dateInput = z.union([z.string().min(1), z.date()]);

export const invoiceIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Invalid invoice id")
});

const invoiceItemSchema = z.object({
  label: z.string().min(1, "Item label is required").max(255),
  amount: amountInput,
  fee_structure_id: idInput.optional()
});

const createInvoiceBodySchema = z.object({
  student_id: idInput,
  academic_year_id: idInput.optional(),
  term_id: idInput.optional(),
  issue_date: dateInput.optional(),
  due_date: dateInput,
  items: z.array(invoiceItemSchema).min(1, "At least one fee item is required"),
  discount: amountInput.optional(),
  previous_balance: amountInput.optional(),
  late_charges: amountInput.optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "pending"]).optional()
});

export const createInvoiceSchema = z.object({ body: createInvoiceBodySchema });

export const updateInvoiceSchema = z.object({
  params: invoiceIdParamSchema,
  body: createInvoiceBodySchema
    .omit({ student_id: true, status: true })
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required"
    })
});

export const listInvoicesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    q: z.string().optional(),
    status: z.nativeEnum(StudentInvoiceStatus).optional(),
    student_id: z.string().regex(/^\d+$/).optional(),
    term_id: z.string().regex(/^\d+$/).optional(),
    academic_year_id: z.string().regex(/^\d+$/).optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional()
  })
});

export const recordInvoicePaymentSchema = z.object({
  params: invoiceIdParamSchema,
  body: z.object({
    amount: z.union([
      z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number"),
      z.number().positive("Amount must be greater than zero")
    ]),
    payment_date: dateInput.optional(),
    payment_method: z.nativeEnum(PaymentMethod).optional()
  })
});

export const invoiceReasonSchema = z.object({
  params: invoiceIdParamSchema,
  body: z
    .object({ reason: z.string().max(500).optional() })
    .optional()
    .default({})
});
