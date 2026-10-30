import { z } from "zod";
import { PlatformUserAccessScope, PlatformUserRole, PlatformUserStatus } from "@prisma/client";

export const platformUserIdParamSchema = z.object({
  id: z.string().min(1)
});

const createPlatformUserBodySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(PlatformUserRole).optional(),
  access_scope: z.nativeEnum(PlatformUserAccessScope).optional(),
  permissions: z.unknown().nullable().optional(),
  status: z.nativeEnum(PlatformUserStatus).optional()
});

const updatePlatformUserBodySchema = createPlatformUserBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listPlatformUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  role: z.nativeEnum(PlatformUserRole).optional(),
  status: z.nativeEnum(PlatformUserStatus).optional(),
  include_deleted: z.preprocess((value) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  }, z.boolean().optional())
});

export const createPlatformUserSchema = z.object({
  body: createPlatformUserBodySchema
});

export const updatePlatformUserSchema = z.object({
  params: platformUserIdParamSchema,
  body: updatePlatformUserBodySchema
});

export const listPlatformUsersSchema = z.object({
  query: listPlatformUsersQuerySchema
});
