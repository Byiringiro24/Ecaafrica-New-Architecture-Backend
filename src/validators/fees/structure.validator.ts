import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const feeStructureIdParamSchema = z.object({
  id: z.string().min(1)
});

const createFeeStructureBodySchema = z.object({
  academic_year_id: idInput,
  term_id: idInput.optional(),
  class_id: idInput.optional(),
  name: z.string().min(1).max(100),
  amount: z.union([z.string(), z.number()]),
  currency: z.string().length(3).optional(),
  is_mandatory: z.boolean().optional(),
  is_active: z.boolean().optional(),
  due_date: dateInput.optional()
});

const updateFeeStructureBodySchema = createFeeStructureBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const cloneFeeStructureBodySchema = z.object({
  term_id: idInput,
  academic_year_id: idInput.optional()
});

const listFeeStructuresQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  academic_year_id: z.string().optional(),
  term_id: z.string().optional(),
  class_id: z.string().optional()
});

export const createFeeStructureSchema = z.object({
  body: createFeeStructureBodySchema
});

export const updateFeeStructureSchema = z.object({
  params: feeStructureIdParamSchema,
  body: updateFeeStructureBodySchema
});

export const cloneFeeStructureSchema = z.object({
  params: feeStructureIdParamSchema,
  body: cloneFeeStructureBodySchema
});

export const listFeeStructuresSchema = z.object({
  query: listFeeStructuresQuerySchema
});
