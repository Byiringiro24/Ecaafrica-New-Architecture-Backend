import { z } from "zod";

const idParam = z.object({ id: z.string().regex(/^\d+$/) });
const percentage = z.union([z.string(), z.number()]).refine((value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100;
}, "Percentage must be between 0 and 100");

export const createExamTypeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(255).optional(),
    is_active: z.boolean().optional()
  })
});

export const updateExamTypeSchema = z.object({
  params: idParam,
  body: createExamTypeSchema.shape.body.partial().refine((data) => Object.keys(data).length > 0)
});

export const examTypeIdSchema = z.object({ params: idParam });

const gradingRoleBody = z.object({
  code: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(100),
  min_percentage: percentage,
  max_percentage: percentage,
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const createGradingRoleSchema = z.object({
  body: gradingRoleBody.refine((data) => Number(data.min_percentage) <= Number(data.max_percentage), {
    message: "Minimum percentage cannot exceed maximum percentage"
  })
});

export const updateGradingRoleSchema = z.object({
  params: idParam,
  body: gradingRoleBody.partial().refine((data) => Object.keys(data).length > 0)
});

export const gradingRoleIdSchema = z.object({ params: idParam });
