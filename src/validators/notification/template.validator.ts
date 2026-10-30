import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

export const templateIdParamSchema = z.object({
  id: z.string().min(1)
});

const templateBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  trigger_type: z.string().min(1).max(50),
  body_en: z.string().min(1),
  body_kin: z.string().optional().nullable(),
  variables: z.record(z.unknown()).optional().nullable(),
  is_active: z.boolean().optional()
});

const updateTemplateBodySchema = templateBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listTemplatesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  is_active: booleanQuery,
  trigger_type: z.string().optional(),
  scope: z.enum(["global"]).optional()
});

const renderTemplateBodySchema = z.object({
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  language: z.enum(["en", "kin"]).optional()
});

export const createTemplateSchema = z.object({
  body: templateBodySchema
});

export const updateTemplateSchema = z.object({
  params: templateIdParamSchema,
  body: updateTemplateBodySchema
});

export const listTemplatesSchema = z.object({
  query: listTemplatesQuerySchema
});

export const renderTemplateSchema = z.object({
  params: templateIdParamSchema,
  body: renderTemplateBodySchema
});
