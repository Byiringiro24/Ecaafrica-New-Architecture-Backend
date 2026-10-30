import { ExamStatus, ExamType } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const examIdParamSchema = z.object({
  id: z.string().min(1)
});

const createExamBodySchema = z.object({
  section_id: idInput.optional(),
  subject_id: idInput,
  teacher_id: idInput.optional(),
  term_id: idInput.optional(),
  exam_type_id: idInput.optional(),
  name: z.string().min(1).max(255),
  type: z.nativeEnum(ExamType).optional(),
  exam_date: dateInput.optional(),
  start_time: z.string().optional(),
  duration_min: z.number().int().positive().optional(),
  max_marks: z.union([z.string(), z.number()]).optional(),
  pass_mark: z.union([z.string(), z.number()]).optional(),
  status: z.nativeEnum(ExamStatus).optional()
});

const updateExamBodySchema = createExamBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listExamsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  section_id: z.string().optional(),
  subject_id: z.string().optional(),
  term_id: z.string().optional(),
  status: z.nativeEnum(ExamStatus).optional(),
  type: z.nativeEnum(ExamType).optional()
});

export const createExamSchema = z.object({
  body: createExamBodySchema
});

export const updateExamSchema = z.object({
  params: examIdParamSchema,
  body: updateExamBodySchema
});

export const listExamsSchema = z.object({
  query: listExamsQuerySchema
});
