import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const idInput = z.union([z.string(), z.number(), z.null()]);

export const classIdParamSchema = z.object({
  id: z.string().min(1)
});

const createClassBodySchemaBase = z.object({
  name: z.string().min(1),
  level_id: idInput.optional(),
  level: z.number().int().min(1).optional(),
  description: z.string().nullable().optional(),
  academic_year_id: idInput.optional(),
  combination_ids: z.array(z.union([z.string(), z.number()])).optional()
});

const createClassBodySchema = createClassBodySchemaBase.refine((data) => data.level_id !== undefined || data.level !== undefined, {
  message: "Either level_id or level is required"
});

const updateClassBodySchema = createClassBodySchemaBase
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listClassesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  academic_year_id: z.string().optional(),
  include_deleted: booleanQuery
});

export const createClassSchema = z.object({
  body: createClassBodySchema
});

export const updateClassSchema = z.object({
  params: classIdParamSchema,
  body: updateClassBodySchema
});

export const listClassesSchema = z.object({
  query: listClassesQuerySchema
});
