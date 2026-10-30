import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const dateInput = z.union([z.string(), z.date()]);
const idInput = z.union([z.string(), z.number()]);

export const termIdParamSchema = z.object({
  id: z.string().min(1)
});

const createTermBodySchema = z.object({
  academic_year_id: idInput,
  name: z.string().min(2),
  start_date: dateInput,
  end_date: dateInput,
  is_current: z.boolean().optional()
});

const updateTermBodySchema = createTermBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listTermsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  academic_year_id: z.string().optional(),
  include_deleted: booleanQuery
});

export const createTermSchema = z.object({
  body: createTermBodySchema
});

export const updateTermSchema = z.object({
  params: termIdParamSchema,
  body: updateTermBodySchema
});

export const listTermsSchema = z.object({
  query: listTermsQuerySchema
});
