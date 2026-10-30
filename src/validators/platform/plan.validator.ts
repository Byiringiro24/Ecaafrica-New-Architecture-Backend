import { z } from "zod";

const decimalSchema = z
  .union([z.number(), z.string()])
  .refine((value) => Number.isFinite(Number(value)), {
    message: "Invalid number"
  });

export const planIdParamSchema = z.object({
  id: z.string().min(1)
});

const createPlanBodySchema = z.object({
  name: z.string().min(2),
  price_monthly: decimalSchema.optional(),
  price_annual: decimalSchema.optional(),
  student_limit: z.number().int().nonnegative().optional(),
  staff_limit: z.number().int().nonnegative().optional(),
  sms_bundle: z.number().int().nonnegative().optional(),
  features: z.unknown().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

const updatePlanBodySchema = createPlanBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const listPlansQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  is_active: z.preprocess((value) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  }, z.boolean().optional()),
  include_deleted: z.preprocess((value) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  }, z.boolean().optional())
});

export const createPlanSchema = z.object({
  body: createPlanBodySchema
});

export const updatePlanSchema = z.object({
  params: planIdParamSchema,
  body: updatePlanBodySchema
});

export const listPlansSchema = z.object({
  query: listPlansQuerySchema
});
