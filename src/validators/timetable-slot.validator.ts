import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const idInput = z.union([z.string(), z.number()]);

export const timetableSlotIdParamSchema = z.object({
  id: z.string().min(1)
});

const createTimetableSlotBodySchema = z.object({
  section_id: idInput,
  subject_id: idInput,
  teacher_id: idInput,
  period_id: idInput,
  day_of_week: z.number().int().min(1).max(7),
  room: z.string().nullable().optional(),
  term_id: idInput.nullable().optional()
});

const updateTimetableSlotBodySchema = createTimetableSlotBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listTimetableSlotsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  section_id: z.string().optional(),
  teacher_id: z.string().optional(),
  subject_id: z.string().optional(),
  term_id: z.string().optional(),
  include_deleted: booleanQuery
});

export const createTimetableSlotSchema = z.object({
  body: createTimetableSlotBodySchema
});

export const updateTimetableSlotSchema = z.object({
  params: timetableSlotIdParamSchema,
  body: updateTimetableSlotBodySchema
});

export const listTimetableSlotsSchema = z.object({
  query: listTimetableSlotsQuerySchema
});

const copyLegacyTimetableBodySchema = z.object({
  term_id: idInput
});

export const copyLegacyTimetableSchema = z.object({
  body: copyLegacyTimetableBodySchema
});

// ─── Bulk create (combined classes) ──────────────────────────────────────────
const bulkCreateBodySchema = z.object({
  section_ids: z.array(idInput).min(1, "At least one section_id is required"),
  subject_id: idInput,
  teacher_id: idInput,
  period_id: idInput,
  day_of_week: z.number().int().min(1).max(7),
  room: z.string().nullable().optional(),
  term_id: idInput.nullable().optional()
});

export const bulkCreateTimetableSlotsSchema = z.object({
  body: bulkCreateBodySchema
});

// ─── Auto-generate (DOS timetable fill) ──────────────────────────────────────
const generateEntrySchema = z.object({
  section_id: idInput,
  subject_id: idInput,
  teacher_id: idInput,
  period_id: idInput,
  days: z.array(z.number().int().min(1).max(7)).min(1, "Specify at least one day"),
  room: z.string().nullable().optional(),
  term_id: idInput.nullable().optional()
});

const generateBodySchema = z.object({
  entries: z.array(generateEntrySchema).min(1, "entries must be a non-empty array"),
  overwrite_existing: z.boolean().optional()
});

export const generateTimetableSlotsSchema = z.object({
  body: generateBodySchema
});
