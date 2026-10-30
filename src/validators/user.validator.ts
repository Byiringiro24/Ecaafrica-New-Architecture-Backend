import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

export const userIdParamSchema = z.object({
  id: z.string().min(1)
});

export const userRoleParamsSchema = z.object({
  id: z.string().min(1),
  roleId: z.string().min(1)
});

const baseUserBodySchema = z.object({
  name: z.string().min(2),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(6).nullable().optional(),
  role: z.nativeEnum(UserRole),
  roles: z.array(z.nativeEnum(UserRole)).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  avatar_url: z.string().url().nullable().optional()
});

const createUserBodySchema = baseUserBodySchema
  .extend({
    password: z.string().min(8)
  })
  .refine((data) => data.email || data.phone, {
    message: "Email or phone is required",
    path: ["email"]
  });

const updateUserBodySchema = baseUserBodySchema
  .extend({
    password: z.string().min(8).optional()
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  role: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  include_deleted: booleanQuery
});

const assignRoleBodySchema = z.object({
  role_id: z.string().min(1)
});

export const createUserSchema = z.object({
  body: createUserBodySchema
});

export const updateUserSchema = z.object({
  params: userIdParamSchema,
  body: updateUserBodySchema
});

export const listUsersSchema = z.object({
  query: listUsersQuerySchema
});

export const assignRoleSchema = z.object({
  params: userIdParamSchema,
  body: assignRoleBodySchema
});
