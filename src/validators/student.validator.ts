import { z } from "zod";
import { EnrollmentStatus, Gender, StudentStatus, StudentType } from "@prisma/client";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }

  return value;
}, z.date());

export const studentIdParamSchema = z.object({
  id: z.string().min(1)
});

const baseStudentBodySchema = z.object({
  user_id: idInput.optional(),
  student_id_number: z.string().trim().min(1).max(30).optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  other_names: z.string().optional(),
  combination: z.string().optional(),
  date_of_birth: dateInput.optional(),
  gender: z.nativeEnum(Gender).optional(),
  national_id: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  blood_group: z.string().optional(),
  photo_url: z.string().url().optional(),
  address: z.string().optional(),
  previous_school: z.string().optional(),
  admission_date: dateInput.optional(),
  enrollment_year: z.coerce.number().int().min(1900).max(2100).optional(),
  student_type: z.nativeEnum(StudentType).optional(),
  status: z.nativeEnum(StudentStatus).optional()
});

const createStudentBodySchema = baseStudentBodySchema;

const updateStudentBodySchema = baseStudentBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listStudentsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  student_school_id: z.string().regex(/^\d+$/).optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  student_type: z.nativeEnum(StudentType).optional(),
  include_deleted: booleanQuery,
  section_id: z.string().optional()
});

const createEnrollmentBodySchema = z.object({
  section_id: idInput,
  academic_year_id: idInput,
  term_id: idInput.optional(),
  enrolled_at: dateInput.optional(),
  left_at: dateInput.optional(),
  status: z.nativeEnum(EnrollmentStatus).optional()
});

const listEnrollmentsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  status: z.nativeEnum(EnrollmentStatus).optional(),
  academic_year_id: z.string().optional(),
  include_deleted: booleanQuery
});

export const studentImportRowSchema = z.object({
  student_id_number: z.string().trim().min(1, "student_id_number is required").optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  other_names: z.string().optional(),
  combination: z.string().optional(),
  date_of_birth: dateInput.optional(),
  gender: z.nativeEnum(Gender).optional(),
  national_id: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  blood_group: z.string().optional(),
  photo_url: z.string().optional(),
  address: z.string().optional(),
  previous_school: z.string().optional(),
  admission_date: dateInput.optional(),
  enrollment_year: z.coerce.number().int().min(1900).max(2100).optional(),
  student_type: z.nativeEnum(StudentType).optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  parent_first_name: z.string().trim().optional(),
  parent_last_name: z.string().trim().optional(),
  parent_relationship: z.string().trim().optional(),
  parent_phone: z.string().trim().optional(),
  parent_phone_alt: z.string().trim().optional(),
  parent_email: z.string().email().optional(),
  parent_national_id: z.string().trim().optional(),
  parent_address: z.string().optional(),
  parent_occupation: z.string().trim().optional()
}).superRefine((row, context) => {
  const hasParentData = [
    row.parent_first_name,
    row.parent_last_name,
    row.parent_relationship,
    row.parent_phone,
    row.parent_phone_alt,
    row.parent_email,
    row.parent_national_id,
    row.parent_address,
    row.parent_occupation
  ].some(Boolean);

  if (!hasParentData) return;
  if (!row.parent_first_name) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["parent_first_name"], message: "parent_first_name is required when parent data is provided" });
  }
  if (!row.parent_last_name) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["parent_last_name"], message: "parent_last_name is required when parent data is provided" });
  }
  if (!row.parent_phone) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["parent_phone"], message: "parent_phone is required when parent data is provided" });
  }
});

export const createStudentSchema = z.object({
  body: createStudentBodySchema
});

export const updateStudentSchema = z.object({
  params: studentIdParamSchema,
  body: updateStudentBodySchema
});

export const updateVisitorAccessSchema = z.object({
  params: studentIdParamSchema,
  body: z.object({ blocked: z.boolean() })
});

export const listStudentsSchema = z.object({
  query: listStudentsQuerySchema
});

export const createStudentEnrollmentSchema = z.object({
  params: studentIdParamSchema,
  body: createEnrollmentBodySchema
});

export const listStudentEnrollmentsSchema = z.object({
  params: studentIdParamSchema,
  query: listEnrollmentsQuerySchema
});
