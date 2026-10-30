import {
  StudentLeaveRequestSource,
  StudentLeaveStatus,
  StudentLeaveType,
} from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const nullableIdInput = z.union([z.string(), z.number(), z.null()]);
const dateInput = z.union([z.string(), z.date()]);

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

export const studentLeaveIdParamSchema = z.object({
  id: z.string().min(1),
});

const createStudentLeaveBodySchema = z.object({
  student_id: idInput,
  parent_id: idInput.optional(),
  requested_by: idInput.optional(),
  source: z.nativeEnum(StudentLeaveRequestSource).optional(),
  leave_type: z.nativeEnum(StudentLeaveType).optional(),
  start_date: dateInput,
  end_date: dateInput,
  reason: z.string().optional(),
  destination: z.string().max(255).optional(),
  parent_contact: z.string().max(50).optional(),
  expected_return_at: dateInput.optional(),
});

const updateStudentLeaveBodySchema = z
  .object({
    student_id: idInput.optional(),
    parent_id: nullableIdInput.optional(),
    leave_type: z.nativeEnum(StudentLeaveType).optional(),
    start_date: dateInput.optional(),
    end_date: dateInput.optional(),
    reason: z.string().nullable().optional(),
    status: z.nativeEnum(StudentLeaveStatus).optional(),
    exited_at: dateInput.nullable().optional(),
    returned_at: dateInput.nullable().optional(),
    is_unauthorized: z.boolean().optional(),
    clarification_note: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const listStudentLeavesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  student_id: z.string().optional(),
  status: z.nativeEnum(StudentLeaveStatus).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  is_unauthorized: booleanQuery,
});

const rejectStudentLeaveBodySchema = z.object({
  rejection_reason: z.string().min(1),
});

const clarificationBodySchema = z.object({
  clarification_note: z.string().min(1),
});

export const createStudentLeaveSchema = z.object({
  body: createStudentLeaveBodySchema,
});

export const updateStudentLeaveSchema = z.object({
  params: studentLeaveIdParamSchema,
  body: updateStudentLeaveBodySchema,
});

export const listStudentLeavesSchema = z.object({
  query: listStudentLeavesQuerySchema,
});

export const approveStudentLeaveSchema = z.object({
  params: studentLeaveIdParamSchema,
});

export const rejectStudentLeaveSchema = z.object({
  params: studentLeaveIdParamSchema,
  body: rejectStudentLeaveBodySchema,
});

export const requestLeaveClarificationSchema = z.object({
  params: studentLeaveIdParamSchema,
  body: clarificationBodySchema,
});
