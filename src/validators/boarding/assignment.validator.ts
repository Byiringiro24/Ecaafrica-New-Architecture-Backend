import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const nullableIdInput = z.union([z.string(), z.number(), z.null()]);
const dateInput = z.union([z.string(), z.date()]);

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

export const dormAssignmentIdParamSchema = z.object({
  id: z.string().min(1)
});

const createDormAssignmentBodySchema = z.object({
  student_id: idInput,
  dormitory_id: idInput,
  room_id: idInput.optional(),
  bed_number: z.string().optional(),
  academic_year_id: idInput,
  assigned_at: dateInput,
  left_at: dateInput.optional()
});

const updateDormAssignmentBodySchema = z
  .object({
    student_id: idInput.optional(),
    dormitory_id: idInput.optional(),
    room_id: nullableIdInput.optional(),
    bed_number: z.string().nullable().optional(),
    academic_year_id: idInput.optional(),
    assigned_at: dateInput.optional(),
    left_at: dateInput.nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listDormAssignmentsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  student_id: z.string().optional(),
  dormitory_id: z.string().optional(),
  class_id: z.string().optional(),
  room_id: z.string().optional(),
  academic_year_id: z.string().optional(),
  is_active: booleanQuery
});

export const createDormAssignmentSchema = z.object({
  body: createDormAssignmentBodySchema
});

export const createDormAssignmentsSchema = z.object({
  body: z.object({
    student_ids: z.array(idInput).min(1),
    dormitory_id: idInput,
    academic_year_id: idInput,
    assigned_at: dateInput,
  }),
});

export const updateDormAssignmentSchema = z.object({
  params: dormAssignmentIdParamSchema,
  body: updateDormAssignmentBodySchema
});

export const listDormAssignmentsSchema = z.object({
  query: listDormAssignmentsQuerySchema
});
