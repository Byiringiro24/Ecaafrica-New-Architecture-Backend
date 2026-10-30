import { AttendanceStatus, ScanMethod } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);

export const attendanceRecordIdParamSchema = z.object({
  id: z.string().min(1)
});

const attendanceRecordBodySchema = z.object({
  session_id: idInput,
  student_id: idInput,
  status: z.nativeEnum(AttendanceStatus),
  scan_method: z.nativeEnum(ScanMethod).optional(),
  notes: z.string().optional()
});

const bulkAttendanceRecordBodySchema = z.object({
  session_id: idInput,
  scan_method: z.nativeEnum(ScanMethod).optional(),
  notify: z.boolean().optional(),
  records: z.array(
    z.object({
      student_id: idInput,
      status: z.nativeEnum(AttendanceStatus),
      notes: z.string().optional()
    })
  )
});

const listAttendanceRecordsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  session_id: z.string().optional(),
  student_id: z.string().optional(),
  class_id: z.string().optional(),
  section_id: z.string().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  student_type: z.string().optional(),
  late: z.union([z.string(), z.boolean()]).optional(),
  grace: z.union([z.string(), z.boolean()]).optional(),
  date: z.string().optional()
});

const attendanceSummaryQuerySchema = z.object({
  start_date: z.string(),
  end_date: z.string()
});

export const createAttendanceRecordSchema = z.object({
  body: attendanceRecordBodySchema
});

export const bulkMarkAttendanceSchema = z.object({
  body: bulkAttendanceRecordBodySchema
});

export const listAttendanceRecordsSchema = z.object({
  query: listAttendanceRecordsQuerySchema
});

export const attendanceSummarySchema = z.object({
  query: attendanceSummaryQuerySchema
});
