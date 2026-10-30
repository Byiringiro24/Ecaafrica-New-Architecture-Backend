import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

export const levelIdParamSchema = z.object({
  id: z.string().min(1)
});

const createLevelBodySchema = z.object({
  label: z.string().min(1),
  sort_order: z.number().int().min(1).optional(),
  is_active: z.boolean().optional()
});

const updateLevelBodySchema = createLevelBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listLevelsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  include_deleted: booleanQuery
});

export const createLevelSchema = z.object({
  body: createLevelBodySchema
});

export const updateLevelSchema = z.object({
  params: levelIdParamSchema,
  body: updateLevelBodySchema
});

export const listLevelsSchema = z.object({
  query: listLevelsQuerySchema
});
