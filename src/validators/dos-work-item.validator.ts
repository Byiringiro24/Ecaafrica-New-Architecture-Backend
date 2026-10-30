import { z } from "zod";

export const dosWorkItemTypes = [
  "calendar", "curriculum", "syllabus", "lesson_plan", "performance",
  "risk", "intervention", "referral", "meeting", "parent_chat", "alert",
  "room", "substitution", "assessment"
] as const;

export const dosWorkItemTypeSchema = z.enum(dosWorkItemTypes);

const payloadSchema = z.record(z.string(), z.unknown()).default({});

export const createDosWorkItemSchema = z.object({
  type: dosWorkItemTypeSchema,
  title: z.string().trim().min(2).max(255),
  status: z.string().trim().min(1).max(30).optional(),
  priority: z.string().trim().min(1).max(20).optional(),
  student_id: z.union([z.string(), z.number()]).optional().nullable(),
  payload: payloadSchema
});

export const updateDosWorkItemSchema = createDosWorkItemSchema.partial();

export const listDosWorkItemsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  type: dosWorkItemTypeSchema.optional(),
  status: z.string().trim().max(30).optional(),
  student_id: z.coerce.string().optional(),
  search: z.string().trim().max(100).optional()
});

export const dosWorkItemIdParamSchema = z.object({ id: z.string().regex(/^\d+$/) });
