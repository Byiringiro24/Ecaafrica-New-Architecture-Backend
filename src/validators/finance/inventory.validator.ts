import { PaymentMethod, POStatus } from "@prisma/client";
import { z } from "zod";

const amountInput = z.union([
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number"),
  z.number().nonnegative("Amount cannot be negative")
]);

const idParam = (label: string) =>
  z.object({ id: z.string().regex(/^\d+$/, `Invalid ${label} id`) });

export const supplierIdParamSchema = idParam("supplier");
export const inventoryIdParamSchema = idParam("inventory item");

export const createInventoryCategorySchema = z.object({
  body: z.object({ name: z.string().trim().min(1, "Category name is required").max(100) })
});

const createSupplierBodySchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(255),
  country_code: z.string().trim().length(2, "Country code must be 2 characters").optional(),
  tin_number: z.string().trim().max(50, "TIN number is too long").optional(),
  category: z.string().max(100).optional(),
  contact_person: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email("Invalid email").max(255).optional(),
  address: z.string().optional(),
  balance: amountInput.optional()
});

export const createSupplierSchema = z.object({ body: createSupplierBodySchema });

export const updateSupplierSchema = z.object({
  params: supplierIdParamSchema,
  body: createSupplierBodySchema
    .partial()
    .extend({ is_active: z.boolean().optional() })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required"
    })
});

export const listSuppliersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    q: z.string().optional(),
    category: z.string().optional(),
    is_active: z.enum(["true", "false"]).optional()
  })
});

const createInventoryBodySchema = z.object({
  item_name: z.string().min(1, "Item name is required").max(255),
  category: z.string().max(100).optional(),
  supplier_id: z.union([z.string(), z.number()]).optional(),
  quantity: z.coerce.number().int().nonnegative("Quantity cannot be negative"),
  unit_cost: amountInput,
  currency: z.string().length(3).optional(),
  reorder_level: z.coerce.number().int().nonnegative().optional(),
  status: z.nativeEnum(POStatus).optional(),
  invoice_url: z.string().max(500).optional(),
  notes: z.string().optional()
});

const paymentBodySchema = z.object({
  amount: amountInput.refine((value) => Number(value) > 0, "Payment amount must be greater than zero"),
  payment_method: z.nativeEnum(PaymentMethod)
});

export const createInventoryItemSchema = z.object({
  body: createInventoryBodySchema
});

export const updateInventoryItemSchema = z.object({
  params: inventoryIdParamSchema,
  body: createInventoryBodySchema
    .omit({ status: true })
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required"
    })
});

export const updateInventoryStatusSchema = z.object({
  params: inventoryIdParamSchema,
  body: z.object({
    status: z.nativeEnum(POStatus)
  })
});

export const paySupplierSchema = z.object({
  params: inventoryIdParamSchema,
  body: paymentBodySchema
});

export const listInventorySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    q: z.string().optional(),
    status: z.nativeEnum(POStatus).optional(),
    category: z.string().optional(),
    supplier_id: z.string().regex(/^\d+$/).optional(),
    low_stock: z.enum(["true", "false"]).optional()
  })
});
