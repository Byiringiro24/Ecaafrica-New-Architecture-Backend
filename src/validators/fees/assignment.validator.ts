import { FeeAssignmentStatus } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const feeAssignmentIdParamSchema = z.object({
  id: z.string().min(1)
});

const createFeeAssignmentBodySchema = z.object({
  student_id: idInput,
  fee_structure_id: idInput,
  amount_due: z.union([z.string(), z.number()]).optional(),
  due_date: dateInput.optional(),
  waiver_reason: z.string().optional()
});

const updateFeeAssignmentBodySchema = z
  .object({
    amount_due: z.union([z.string(), z.number()]).optional(),
    due_date: dateInput.optional(),
    status: z.nativeEnum(FeeAssignmentStatus).optional(),
    waiver_reason: z.string().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const bulkAssignBodySchema = z.object({
  fee_structure_id: idInput,
  section_id: idInput,
  academic_year_id: idInput.optional(),
  term_id: idInput.optional(),
  due_date: dateInput.optional()
});

const listFeeAssignmentsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  student_id: z.string().optional(),
  fee_structure_id: z.string().optional(),
  status: z.nativeEnum(FeeAssignmentStatus).optional()
});

export const createFeeAssignmentSchema = z.object({
  body: createFeeAssignmentBodySchema
});

export const updateFeeAssignmentSchema = z.object({
  params: feeAssignmentIdParamSchema,
  body: updateFeeAssignmentBodySchema
});

export const bulkAssignFeeSchema = z.object({
  body: bulkAssignBodySchema
});

export const listFeeAssignmentsSchema = z.object({
  query: listFeeAssignmentsQuerySchema
});
