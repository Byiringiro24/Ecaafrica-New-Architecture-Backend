/**
 * @swagger
 * tags:
 *   - name: Attendance Records
 *     description: Attendance record management
 *
 * /attendance/records:
 *   get:
 *     summary: List attendance records
 *     tags: [Attendance Records]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *   post:
 *     summary: Mark attendance record
 *     tags: [Attendance Records]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /attendance/records/bulk:
 *   post:
 *     summary: Bulk mark attendance
 *     tags: [Attendance Records]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /attendance/records/summary:
 *   get:
 *     summary: Get attendance summary
 *     tags: [Attendance Records]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /attendance/records/{id}:
 *   delete:
 *     summary: Delete attendance record
 *     tags: [Attendance Records]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
import { Router } from "express";
import * as recordController from "../../controllers/attendance/record.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { rejectGateKeeperAttendanceWrite, requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  attendanceRecordIdParamSchema,
  attendanceSummarySchema,
  bulkMarkAttendanceSchema,
  createAttendanceRecordSchema,
  listAttendanceRecordsSchema
} from "../../validators/attendance/record.validator";

export const attendanceRecordRoutes = Router();

attendanceRecordRoutes.use(verifyToken, requireSchoolAccess);

attendanceRecordRoutes.get(
  "/",
  validate(listAttendanceRecordsSchema),
  asyncWrapper(recordController.listAttendanceRecords)
);

attendanceRecordRoutes.post(
  "/",
  rejectGateKeeperAttendanceWrite,
  validate(createAttendanceRecordSchema),
  asyncWrapper(recordController.createAttendanceRecord)
);

attendanceRecordRoutes.post(
  "/bulk",
  rejectGateKeeperAttendanceWrite,
  validate(bulkMarkAttendanceSchema),
  asyncWrapper(recordController.bulkMarkAttendance)
);

/**
 * POST /attendance/records/submit
 * Single-call: find-or-create session + upsert all records atomically.
 * Replaces the old two-step (POST /sessions then POST /records/bulk).
 * Concurrent teachers never conflict — DB unique index + upserts handle everything.
 */
attendanceRecordRoutes.post(
  "/submit",
  rejectGateKeeperAttendanceWrite,
  asyncWrapper(recordController.bulkMarkWithSession)
);

attendanceRecordRoutes.get(
  "/summary",
  validate(attendanceSummarySchema),
  asyncWrapper(recordController.getAttendanceSummary)
);

attendanceRecordRoutes.delete(
  "/:id",
  rejectGateKeeperAttendanceWrite,
  validate({ params: attendanceRecordIdParamSchema }),
  asyncWrapper(recordController.deleteAttendanceRecord)
);

// Device logs feature endpoints
/**
 * GET /attendance/records/logs - Fetch device logs with filtering and pagination
 * Used by the device logs page for displaying attendance data from biometric devices
 */
attendanceRecordRoutes.get(
  "/logs",
  asyncWrapper(recordController.listGateLogs)
);

/**
 * GET /attendance/records/today - Fetch today's attendance logs
 */
attendanceRecordRoutes.get(
  "/today",
  asyncWrapper(recordController.listTodayGateLogs)
);

/**
 * GET /attendance/records/stats - Get attendance statistics
 */
attendanceRecordRoutes.get(
  "/stats",
  asyncWrapper(recordController.getAttendanceStatsController)
);

// ─── New: attendance_logs-backed endpoints ────────────────────────────────────

/**
 * GET /attendance/records/device-logs
 * Primary endpoint for the device-logs page — reads from attendance_logs table.
 * Supports full filtering: startDate, endDate, studentId, deviceId, method,
 * status, syncState, search, page, limit.
 */
attendanceRecordRoutes.get(
  "/device-logs",
  asyncWrapper(recordController.listDeviceAttendanceLogs)
);

/**
 * GET /attendance/records/device-logs/today
 * Today's device attendance logs from attendance_logs.
 */
attendanceRecordRoutes.get(
  "/device-logs/today",
  asyncWrapper(recordController.listTodayDeviceAttendanceLogs)
);

/**
 * GET /attendance/records/device-logs/stats
 * Aggregate stats from attendance_logs.
 */
attendanceRecordRoutes.get(
  "/device-logs/stats",
  asyncWrapper(recordController.getDeviceAttendanceLogStats)
);
