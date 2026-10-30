/**
 * @swagger
 * tags:
 *   - name: Attendance Sessions
 *     description: Attendance session management
 *
 * /attendance/sessions:
 *   get:
 *     summary: List attendance sessions
 *     tags: [Attendance Sessions]
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
 *     summary: Create attendance session
 *     tags: [Attendance Sessions]
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
 * /attendance/sessions/{id}:
 *   get:
 *     summary: Get attendance session by id
 *     tags: [Attendance Sessions]
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
 *   patch:
 *     summary: Update attendance session
 *     tags: [Attendance Sessions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
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
 *   delete:
 *     summary: Delete attendance session
 *     tags: [Attendance Sessions]
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
 *
 * /attendance/sessions/{id}/close:
 *   patch:
 *     summary: Close attendance session
 *     tags: [Attendance Sessions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
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
 */
import { Router } from "express";
import * as sessionController from "../../controllers/attendance/session.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { rejectGateKeeperAttendanceWrite, requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  attendanceSessionIdParamSchema,
  closeAttendanceSessionSchema,
  createAttendanceSessionSchema,
  listAttendanceSessionsSchema,
  updateAttendanceSessionSchema
} from "../../validators/attendance/session.validator";

export const attendanceSessionRoutes = Router();

attendanceSessionRoutes.use(verifyToken, requireSchoolAccess);

attendanceSessionRoutes.get(
  "/",
  validate(listAttendanceSessionsSchema),
  asyncWrapper(sessionController.listSessions)
);

attendanceSessionRoutes.post(
  "/",
  rejectGateKeeperAttendanceWrite,
  validate(createAttendanceSessionSchema),
  asyncWrapper(sessionController.createSession)
);

attendanceSessionRoutes.get(
  "/:id",
  validate({ params: attendanceSessionIdParamSchema }),
  asyncWrapper(sessionController.getSession)
);

attendanceSessionRoutes.patch(
  "/:id",
  rejectGateKeeperAttendanceWrite,
  validate(updateAttendanceSessionSchema),
  asyncWrapper(sessionController.updateSession)
);

attendanceSessionRoutes.patch(
  "/:id/close",
  rejectGateKeeperAttendanceWrite,
  validate(closeAttendanceSessionSchema),
  asyncWrapper(sessionController.closeSession)
);

attendanceSessionRoutes.delete(
  "/:id",
  rejectGateKeeperAttendanceWrite,
  validate({ params: attendanceSessionIdParamSchema }),
  asyncWrapper(sessionController.deleteSession)
);
