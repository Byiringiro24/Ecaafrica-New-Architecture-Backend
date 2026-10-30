import { z } from "zod";

export const studentReportCardParamSchema = z.object({
  studentId: z.string().min(1)
});

export const sectionReportCardParamSchema = z.object({
  sectionId: z.string().min(1)
});

const reportCardQuerySchema = z.object({
  term_id: z.string().optional()
});

export const studentReportCardSchema = z.object({
  params: studentReportCardParamSchema,
  query: reportCardQuerySchema
});

export const sectionReportCardSchema = z.object({
  params: sectionReportCardParamSchema,
  query: reportCardQuerySchema
});
