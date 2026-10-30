import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const idInput = z.union([z.string(), z.number()]);
const capacityInput = z.number().int().min(1).max(32767);

export const sectionIdParamSchema = z.object({
  id: z.string().min(1)
});

const createSectionBodySchema = z.object({
  class_id: idInput,
  name: z.string().min(1),
  full_name: z.string().min(1),
  class_teacher_id: idInput.optional(),
  capacity: capacityInput.optional(),
  room: z.string().nullable().optional()
});

const updateSectionBodySchema = createSectionBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listSectionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  class_id: z.string().optional(),
  include_deleted: booleanQuery
});

export const createSectionSchema = z.object({
  body: createSectionBodySchema
});

export const updateSectionSchema = z.object({
  params: sectionIdParamSchema,
  body: updateSectionBodySchema
});

export const listSectionsSchema = z.object({
  query: listSectionsQuerySchema
});
