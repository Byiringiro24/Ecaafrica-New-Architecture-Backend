import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);

export const examResultIdParamSchema = z.object({
  id: z.string().min(1)
});

export const examIdParamSchema = z.object({
  examId: z.string().min(1)
});

export const studentIdParamSchema = z.object({
  studentId: z.string().min(1)
});

const resultItemSchema = z.object({
  student_id: idInput,
  score: z.union([z.string(), z.number()]).optional(),
  grade: z.string().max(5).optional(),
  remarks: z.string().max(255).optional(),
  is_absent: z.boolean().optional()
});

const createExamResultBodySchema = z.object({
  exam_id: idInput,
  student_id: idInput,
  score: z.union([z.string(), z.number()]).optional(),
  grade: z.string().max(5).optional(),
  remarks: z.string().max(255).optional(),
  is_absent: z.boolean().optional()
});

const updateExamResultBodySchema = z
  .object({
    score: z.union([z.string(), z.number()]).optional(),
    grade: z.string().max(5).optional(),
    remarks: z.string().max(255).optional(),
    is_absent: z.boolean().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const bulkRecordBodySchema = z.object({
  exam_id: idInput,
  results: z.array(resultItemSchema).min(1)
});

const listExamResultsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  exam_id: z.string().optional(),
  student_id: z.string().optional()
});

export const createExamResultSchema = z.object({
  body: createExamResultBodySchema
});

export const updateExamResultSchema = z.object({
  params: examResultIdParamSchema,
  body: updateExamResultBodySchema
});

export const bulkRecordExamResultsSchema = z.object({
  body: bulkRecordBodySchema
});

export const listExamResultsSchema = z.object({
  query: listExamResultsQuerySchema
});
