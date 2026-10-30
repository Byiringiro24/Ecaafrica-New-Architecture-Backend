import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const idInput = z.union([z.string(), z.number()]);

export const teacherSectionSubjectIdParamSchema = z.object({
  id: z.string().min(1)
});

const createTeacherSectionSubjectBodySchema = z.object({
  teacher_id: idInput,
  section_id: idInput,
  subject_id: idInput,
  term_id: idInput.optional()
});

const updateTeacherSectionSubjectBodySchema = createTeacherSectionSubjectBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listTeacherSectionSubjectsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  teacher_id: z.string().optional(),
  section_id: z.string().optional(),
  subject_id: z.string().optional(),
  term_id: z.string().optional(),
  include_deleted: booleanQuery
});

export const createTeacherSectionSubjectSchema = z.object({
  body: createTeacherSectionSubjectBodySchema
});

export const updateTeacherSectionSubjectSchema = z.object({
  params: teacherSectionSubjectIdParamSchema,
  body: updateTeacherSectionSubjectBodySchema
});

export const listTeacherSectionSubjectsSchema = z.object({
  query: listTeacherSectionSubjectsQuerySchema
});
