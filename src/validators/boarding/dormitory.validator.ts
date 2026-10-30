import { DormGender } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const capacityInput = z.number().int().min(1).max(32767);

export const dormitoryIdParamSchema = z.object({
  id: z.string().min(1)
});

const createDormitoryBodySchema = z.object({
  name: z.string().min(1),
  gender: z.nativeEnum(DormGender).optional(),
  capacity: capacityInput.optional(),
  supervisor_id: idInput.optional(),
  description: z.string().optional()
});

const updateDormitoryBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    gender: z.nativeEnum(DormGender).optional(),
    capacity: capacityInput.optional(),
    supervisor_id: idInput.nullable().optional(),
    description: z.string().nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listDormitoriesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  gender: z.nativeEnum(DormGender).optional()
});

export const createDormitorySchema = z.object({
  body: createDormitoryBodySchema
});

export const updateDormitorySchema = z.object({
  params: dormitoryIdParamSchema,
  body: updateDormitoryBodySchema
});

export const listDormitoriesSchema = z.object({
  query: listDormitoriesQuerySchema
});
