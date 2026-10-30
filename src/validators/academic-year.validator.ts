import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const dateInput = z.union([z.string(), z.date()]);

export const academicYearIdParamSchema = z.object({
  id: z.string().min(1)
});

const createAcademicYearBodySchema = z.object({
  name: z.string().min(2),
  start_date: dateInput,
  end_date: dateInput,
  is_current: z.boolean().optional()
});

const updateAcademicYearBodySchema = createAcademicYearBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listAcademicYearsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  include_deleted: booleanQuery
});

export const createAcademicYearSchema = z.object({
  body: createAcademicYearBodySchema
});

export const updateAcademicYearSchema = z.object({
  params: academicYearIdParamSchema,
  body: updateAcademicYearBodySchema
});

export const listAcademicYearsSchema = z.object({
  query: listAcademicYearsQuerySchema
});
