import { VisitorAppointmentStatus, VisitorPurpose } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const appointmentIdParamSchema = z.object({
  id: z.string().min(1)
});

const createAppointmentBodySchema = z.object({
  visitor_id: idInput,
  student_id: idInput.optional(),
  host_id: idInput.optional(),
  purpose: z.nativeEnum(VisitorPurpose).optional(),
  appointment_at: dateInput,
  expected_duration_min: z.number().int().positive().optional(),
  notes: z.string().optional()
});

const updateAppointmentBodySchema = z
  .object({
    student_id: idInput.nullable().optional(),
    host_id: idInput.nullable().optional(),
    purpose: z.nativeEnum(VisitorPurpose).optional(),
    appointment_at: dateInput.optional(),
    expected_duration_min: z.number().int().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
    status: z.nativeEnum(VisitorAppointmentStatus).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listAppointmentsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  visitor_id: z.string().optional(),
  student_id: z.string().optional(),
  host_id: z.string().optional(),
  status: z.nativeEnum(VisitorAppointmentStatus).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional()
});

export const createAppointmentSchema = z.object({
  body: createAppointmentBodySchema
});

export const updateAppointmentSchema = z.object({
  params: appointmentIdParamSchema,
  body: updateAppointmentBodySchema
});

export const listAppointmentsSchema = z.object({
  query: listAppointmentsQuerySchema
});
