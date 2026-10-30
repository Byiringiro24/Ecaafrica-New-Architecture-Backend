import { z } from "zod";

export const systemSettingIdParamSchema = z.object({
  id: z.string().min(1)
});

export const systemSettingKeyParamSchema = z.object({
  key: z.string().min(1)
});

const settingBodySchema = z.object({
  key_name: z.string().min(1).max(100),
  value: z.unknown().optional(),
  type: z.enum(["string", "integer", "boolean", "json"]).optional()
});

const updateSettingBodySchema = z
  .object({
    value: z.unknown().optional(),
    type: z.enum(["string", "integer", "boolean", "json"]).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listSettingsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  q: z.string().optional()
});

export const createSystemSettingSchema = z.object({
  body: settingBodySchema
});

export const updateSystemSettingSchema = z.object({
  params: systemSettingIdParamSchema,
  body: updateSettingBodySchema
});

export const updateSystemSettingByKeySchema = z.object({
  params: systemSettingKeyParamSchema,
  body: updateSettingBodySchema
});

export const listSystemSettingsSchema = z.object({
  query: listSettingsQuerySchema
});
