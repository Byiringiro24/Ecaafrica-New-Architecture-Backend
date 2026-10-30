import {
  EmploymentStatus,
  Gender,
  StaffContractType
} from "@prisma/client";
import { z } from "zod";

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

const nonFutureDateInput = dateInput.refine((value) => {
  const today = new Date();
  const candidate = new Date(value);
  return candidate.toISOString().slice(0, 10) <= today.toISOString().slice(0, 10);
}, {
  message: "Date cannot be in the future"
});

export const staffProfileIdParamSchema = z.object({
  id: z.string().min(1)
});

const createStaffProfileBodySchema = z.object({
  user_id: idInput.optional(),
  staff_id_number: z.string().max(30).optional(),
  gender: z.nativeEnum(Gender).optional(),
  department: z.string().max(100).optional(),
  contract_type: z.nativeEnum(StaffContractType).optional(),
  join_date: nonFutureDateInput.optional(),
  date_of_birth: nonFutureDateInput.optional(),
  national_id: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  emergency_contact: z.string().max(100).optional(),
  qualifications: z.string().max(255).optional(),
  experience: z.string().max(100).optional(),
  timetable_access: z.string().max(50).optional(),
  basic_salary: z.union([z.string(), z.number()]).optional(),
  employment_status: z.nativeEnum(EmploymentStatus).optional(),
  subjects: z.array(z.string()).optional()
});

const updateStaffProfileBodySchema = createStaffProfileBodySchema
  .extend({
    user_id: idInput.nullable().optional(),
    staff_id_number: z.string().max(30).nullable().optional(),
    gender: z.nativeEnum(Gender).nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    contract_type: z.nativeEnum(StaffContractType).nullable().optional(),
    join_date: nonFutureDateInput.nullable().optional(),
    date_of_birth: nonFutureDateInput.nullable().optional(),
    national_id: z.string().max(30).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    emergency_contact: z.string().max(100).nullable().optional(),
    qualifications: z.string().max(255).nullable().optional(),
    experience: z.string().max(100).nullable().optional(),
    timetable_access: z.string().max(50).nullable().optional(),
    basic_salary: z.union([z.string(), z.number()]).nullable().optional(),
    subjects: z.array(z.string()).nullable().optional()
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listStaffProfilesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  department: z.string().optional(),
  employment_status: z.nativeEnum(EmploymentStatus).optional(),
  contract_type: z.nativeEnum(StaffContractType).optional()
});

export const createStaffProfileSchema = z.object({
  body: createStaffProfileBodySchema
});

export const updateStaffProfileSchema = z.object({
  params: staffProfileIdParamSchema,
  body: updateStaffProfileBodySchema
});

export const listStaffProfilesSchema = z.object({
  query: listStaffProfilesQuerySchema
});
