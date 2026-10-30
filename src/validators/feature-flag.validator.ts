import { z } from "zod";

export const featureFlagIdParamSchema = z.object({
  id: z.string().min(1)
});

const featureFlagBodySchema = z.object({
  key_name: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  is_enabled: z.boolean().optional(),
  is_beta: z.boolean().optional()
});

const updateFeatureFlagBodySchema = featureFlagBodySchema
  .omit({ key_name: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listFeatureFlagsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional()
});

export const createFeatureFlagSchema = z.object({
  body: featureFlagBodySchema
});

export const updateFeatureFlagSchema = z.object({
  params: featureFlagIdParamSchema,
  body: updateFeatureFlagBodySchema
});

export const listFeatureFlagsSchema = z.object({
  query: listFeatureFlagsQuerySchema
});

export const featureFlagKeyParamSchema = z.object({
  key: z.string().min(1)
});
