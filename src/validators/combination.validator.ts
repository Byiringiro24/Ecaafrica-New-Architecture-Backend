import { z } from "zod";

const id = z.union([z.string(), z.number()]);
const ids = z.array(id).default([]);

export const combinationIdParamSchema = z.object({ id: z.string().min(1) });

const body = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(100),
  description: z.string().nullable().optional(),
  subject_ids: ids.optional(),
  class_ids: ids.optional(),
  is_active: z.boolean().optional()
});

export const createCombinationSchema = z.object({ body: body.omit({ is_active: true }) });
export const updateCombinationSchema = z.object({
  params: combinationIdParamSchema,
  body: body.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  })
});
export const listCombinationsSchema = z.object({
  query: z.object({ page: z.string().optional(), limit: z.string().optional(), include_deleted: z.string().optional() })
});
