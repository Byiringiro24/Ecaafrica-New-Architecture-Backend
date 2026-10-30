import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const visitIdParamSchema = z.object({
  id: z.string().min(1)
});

const createVisitBodySchema = z.object({
  visitor_id: idInput,
  appointment_id: idInput.optional(),
  student_id: idInput.optional(),
  host_id: idInput.optional(),
  purpose: z.string().max(100).optional(),
  // The server assigns checked_in_at. This is retained only for backwards
  // compatibility with older clients; client timestamps are never trusted.
  checked_in_at: dateInput.optional(),
  expected_duration_min: z.number().int().positive().optional(),
  expected_out_at: dateInput.optional(),
  notes: z.string().optional(),
  badge_printed: z.boolean().optional(),
  sms_sent_host: z.boolean().optional()
});

const updateVisitBodySchema = z
  .object({
    appointment_id: idInput.nullable().optional(),
    student_id: idInput.nullable().optional(),
    host_id: idInput.nullable().optional(),
    purpose: z.string().max(100).nullable().optional(),
    expected_out_at: dateInput.nullable().optional(),
    checked_out_at: dateInput.optional(),
    notes: z.string().nullable().optional(),
    badge_printed: z.boolean().optional(),
    sms_sent_host: z.boolean().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listVisitsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  visitor_id: z.string().optional(),
  student_id: z.string().optional(),
  appointment_id: z.string().optional(),
  active_only: z.enum(["true", "false"]).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional()
});

export const createVisitSchema = z.object({
  body: createVisitBodySchema
});

export const updateVisitSchema = z.object({
  params: visitIdParamSchema,
  body: updateVisitBodySchema
});

export const listVisitsSchema = z.object({
  query: listVisitsQuerySchema
});
