import { ScanMethod } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as recordService from "../../services/attendance/record.service";
import * as sessionService from "../../services/attendance/session.service";
import * as attendanceLogsService from "../../services/attendance/attendance-logs.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createAttendanceRecord = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const markedBy = req.user?.id;
  const record = await recordService.markAttendance(
    schoolId,
    req.body.session_id,
    req.body.student_id,
    req.body.status,
    ScanMethod.manual,
    { notes: req.body.notes, marked_by: markedBy }
  );

  res.status(201).json(successResponse(record));
};

export const bulkMarkAttendance = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const markedBy = req.user?.id;
  const records = await recordService.bulkMarkAttendance(
    schoolId,
    req.body.records.map((record: { student_id: string; status: string; notes?: string }) => ({
      studentId: record.student_id,
      status: record.status,
      notes: record.notes
    })),
    req.body.session_id,
    ScanMethod.manual,
    markedBy,
    req.body.notify !== false
  );

  res.status(201).json(successResponse(records));
};

/**
 * POST /attendance/records/submit
 *
 * Single-call attendance submission — finds or creates the session then
 * upserts all records in one request.  The frontend no longer needs two
 * round-trips (create session → submit records) so there is zero window
 * for a race condition between the two steps.
 *
 * Body shape:
 * {
 *   section_id : string   (required)
 *   date       : string   YYYY-MM-DD (required)
 *   teacher_id : string   (required)
 *   subject_id : string   (optional)
 *   period_id  : string   (optional)
 *   records    : Array<{ student_id: string; status: string; notes?: string }>
 *   notify     : boolean  (optional, default true)
 * }
 *
 * Returns: { session, records }
 */
export const bulkMarkWithSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const markedBy = req.user?.id;

  const {
    section_id,
    date,
    teacher_id,
    subject_id,
    period_id,
    records: rawRecords,
    notify,
  } = req.body;

  if (!section_id) throw new AppError("bad_request", "section_id is required", 400);
  if (!date)       throw new AppError("bad_request", "date is required", 400);
  if (!rawRecords?.length) throw new AppError("bad_request", "records array is required and must not be empty", 400);

  // Step 1 — find or create the session.
  // Uses INSERT … ON CONFLICT DO NOTHING at the DB level — fully concurrent,
  // zero chance of a duplicate-key error regardless of how many teachers
  // are submitting attendance simultaneously.
  const session = await sessionService.createSession(schoolId, {
    section_id,
    session_date: date,
    teacher_id: teacher_id ?? markedBy,
    subject_id: subject_id ?? undefined,
    period_id:  period_id  ?? undefined,
    session_type: "class",
    started_at: new Date(),
  });

  // Step 2 — upsert every record.
  // Each upsert is a single  INSERT … ON CONFLICT (session_id, student_id) DO UPDATE
  // at the Postgres level — two concurrent submits for the same student simply
  // both succeed, the last write wins, no error is ever thrown.
  const records = await recordService.bulkMarkAttendance(
    schoolId,
    rawRecords.map((r: { student_id: string; status: string; notes?: string }) => ({
      studentId: r.student_id,
      status:    r.status,
      notes:     r.notes,
    })),
    session.id,
    ScanMethod.manual,
    markedBy,
    notify !== false
  );

  res.status(201).json(successResponse({ session, records }));
};

export const listAttendanceRecords = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    session_id:   req.query.session_id   as string | undefined,
    student_id:   req.query.student_id   as string | undefined,
    class_id:     req.query.class_id     as string | undefined,
    section_id:   req.query.section_id   as string | undefined,
    teacher_id:   req.query.teacher_id   as string | undefined,
    period_id:    req.query.period_id    as string | undefined,
    subject_id:   req.query.subject_id   as string | undefined,
    session_type: req.query.session_type as string | undefined,
    status:       req.query.status       as import("@prisma/client").AttendanceStatus | undefined,
    student_type: req.query.student_type as string | undefined,
    late:  req.query.late  === "true" || req.query.late  === "1",
    grace: req.query.grace === "true" || req.query.grace === "1",
    date:      req.query.date       as string | undefined,
    start_date: req.query.start_date as string | undefined,
    end_date:   req.query.end_date   as string | undefined,
  };

  const result = await recordService.findAllAttendanceRecords(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getAttendanceSummary = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const summary = await recordService.getAttendanceSummary(schoolId, {
    startDate: req.query.start_date as string,
    endDate: req.query.end_date as string
  });
  res.json(successResponse(summary));
};

export const deleteAttendanceRecord = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await recordService.deleteAttendanceRecord(schoolId, req.params.id);
  res.json(successResponse(record));
};

/**
 * GET /attendance - Fetch device logs with filtering and pagination
 * Used by the device logs page for displaying attendance data from biometric devices
 */
export const listGateLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  
  // Parse pagination parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Parse filter parameters
  const filters = {
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    studentId: req.query.studentId as string | undefined,
    deviceId: req.query.deviceId as string | undefined,
    method: req.query.method as string | undefined,
    status: req.query.status as import("@prisma/client").AttendanceStatus | undefined,
    syncState: req.query.syncState as string | undefined,
    search: req.query.search as string | undefined
  };
  
  const result = await recordService.findGateLogsForSchool(schoolId, filters, { page, limit });
  res.json(successResponse(result.data, result.meta));
};

/**
 * GET /attendance/today - Fetch today's attendance logs
 */
export const listTodayGateLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const logs = await recordService.findTodayGateLogs(schoolId);
  res.json(successResponse(logs));
};

/**
 * GET /attendance/stats - Get attendance statistics
 */
export const getAttendanceStatsController = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const filters = {
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined
  };
  const stats = await recordService.getAttendanceStats(schoolId, filters);
  res.json(successResponse(stats));
};

// ─── New: attendance_logs-backed endpoints ────────────────────────────────────

/**
 * GET /attendance/records/device-logs
 * Returns paginated logs from the attendance_logs table (device-generated scans).
 * This is the primary data source for the frontend device-logs page.
 */
export const listDeviceAttendanceLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 20));

  const filters: attendanceLogsService.AttendanceLogsFilters = {
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    studentId: req.query.studentId as string | undefined,
    deviceId: req.query.deviceId as string | undefined,
    method: req.query.method as string | undefined,
    status: req.query.status as string | undefined,
    syncState: req.query.syncState as string | undefined,
    search: req.query.search as string | undefined,
    className: req.query.className as string | undefined,
    section: req.query.section as string | undefined,
    direction: req.query.direction as string | undefined,
  };

  const result = await attendanceLogsService.listAttendanceLogs(schoolId, filters, { page, limit });
  res.json(successResponse(result.data, result.meta));
};

/**
 * GET /attendance/records/device-logs/today
 * Returns today's device attendance logs.
 */
export const listTodayDeviceAttendanceLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const logs = await attendanceLogsService.getTodayAttendanceLogs(schoolId);
  res.json(successResponse(logs));
};

/**
 * GET /attendance/records/device-logs/stats
 * Returns aggregate statistics from attendance_logs.
 */
export const getDeviceAttendanceLogStats = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const filters = {
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined
  };
  const stats = await attendanceLogsService.getAttendanceLogStats(schoolId, filters);
  res.json(successResponse(stats));
};
