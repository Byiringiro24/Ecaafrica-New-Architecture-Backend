import { AttendanceSessionType } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const attendanceSessionIdParamSchema = z.object({
  id: z.string().min(1)
});

const createAttendanceSessionBodySchema = z.object({
  section_id: idInput,
  subject_id: idInput.optional(),
  teacher_id: idInput.optional(),
  period_id: idInput.optional(),
  session_date: dateInput,
  session_type: z.nativeEnum(AttendanceSessionType).optional(),
  started_at: dateInput.optional(),
  notes: z.string().optional()
});

const updateAttendanceSessionBodySchema = createAttendanceSessionBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listAttendanceSessionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  section_id: z.string().optional(),
  class_id: z.string().optional(),
  session_type: z.nativeEnum(AttendanceSessionType).optional(),
  period_id: z.string().optional(),
  subject_id: z.string().optional(),
  teacher_id: z.string().optional(),
  date: z.string().optional()
});

export const createAttendanceSessionSchema = z.object({
  body: createAttendanceSessionBodySchema
});

export const updateAttendanceSessionSchema = z.object({
  params: attendanceSessionIdParamSchema,
  body: updateAttendanceSessionBodySchema
});

export const listAttendanceSessionsSchema = z.object({
  query: listAttendanceSessionsQuerySchema
});

export const closeAttendanceSessionSchema = z.object({
  params: attendanceSessionIdParamSchema
});
