import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

export const subjectIdParamSchema = z.object({
  id: z.string().min(1)
});

const createSubjectBodySchema = z.object({
  name: z.string().min(2),
  code: z.string().nullable().optional(),
  description: z.string().nullable().optional()
});

const updateSubjectBodySchema = createSubjectBodySchema
  .partial()
  .extend({ is_active: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listSubjectsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  include_deleted: booleanQuery
});

export const createSubjectSchema = z.object({
  body: createSubjectBodySchema
});

export const updateSubjectSchema = z.object({
  params: subjectIdParamSchema,
  body: updateSubjectBodySchema
});

export const listSubjectsSchema = z.object({
  query: listSubjectsQuerySchema
});
