import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);

export const parentIdParamSchema = z.object({
  id: z.string().min(1)
});

export const studentParentParamsSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1)
});

const baseParentBodySchema = z.object({
  user_id: idInput.optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().min(6),
  phone_alt: z.string().optional(),
  email: z.string().email().optional(),
  national_id: z.string().optional(),
  relationship: z.string().min(1),
  address: z.string().optional(),
  occupation: z.string().optional()
});

const createParentBodySchema = baseParentBodySchema;

const updateParentBodySchema = baseParentBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listParentsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional()
});

const linkParentBodySchema = z.object({
  parent_id: idInput,
  is_primary: z.boolean().optional()
});

export const createParentSchema = z.object({
  body: createParentBodySchema
});

export const updateParentSchema = z.object({
  params: parentIdParamSchema,
  body: updateParentBodySchema
});

export const listParentsSchema = z.object({
  query: listParentsQuerySchema
});

export const linkParentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: linkParentBodySchema
});
