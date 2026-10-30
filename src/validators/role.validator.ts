import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

export const roleIdParamSchema = z.object({
  id: z.string().min(1)
});

const createRoleBodySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  permissions: z.unknown().optional(),
  is_system: z.boolean().optional()
});

const updateRoleBodySchema = createRoleBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listRolesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  include_deleted: booleanQuery
});

export const createRoleSchema = z.object({
  body: createRoleBodySchema
});

export const updateRoleSchema = z.object({
  params: roleIdParamSchema,
  body: updateRoleBodySchema
});

export const listRolesSchema = z.object({
  query: listRolesQuerySchema
});
