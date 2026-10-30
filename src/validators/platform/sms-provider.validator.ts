import { z } from "zod";

export const smsProviderIdParamSchema = z.object({
  id: z.string().min(1)
});

const smsProviderBodySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(30),
  api_key_masked: z.string().max(100).optional().nullable(),
  sender_id: z.string().max(20).optional().nullable(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  priority: z.number().int().min(1).max(32767).optional(),
  unit_cost: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d{1,4})?$/)]).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  config: z.record(z.unknown()).optional().nullable()
});

const updateSmsProviderBodySchema = smsProviderBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listSmsProvidersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional()
});

export const createSmsProviderSchema = z.object({
  body: smsProviderBodySchema
});

export const updateSmsProviderSchema = z.object({
  params: smsProviderIdParamSchema,
  body: updateSmsProviderBodySchema
});

export const listSmsProvidersSchema = z.object({
  query: listSmsProvidersQuerySchema
});
