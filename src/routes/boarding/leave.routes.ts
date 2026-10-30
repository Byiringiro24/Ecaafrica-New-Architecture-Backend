/**
 * @swagger
 * tags:
 *   - name: Boarding Student Leaves
 *     description: Boarding leave requests
 *
 * /boarding/student-leaves:
 *   get:
 *     summary: List student leave requests
 *     tags: [Boarding Student Leaves]
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
 *     summary: Create student leave request
 *     tags: [Boarding Student Leaves]
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
 * /boarding/student-leaves/{id}:
 *   get:
 *     summary: Get student leave request by id
 *     tags: [Boarding Student Leaves]
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
 *     summary: Update student leave request
 *     tags: [Boarding Student Leaves]
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
 *     summary: Delete student leave request
 *     tags: [Boarding Student Leaves]
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
 * /boarding/student-leaves/{id}/approve:
 *   patch:
 *     summary: Approve student leave request
 *     tags: [Boarding Student Leaves]
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
 * /boarding/student-leaves/{id}/reject:
 *   patch:
 *     summary: Reject student leave request
 *     tags: [Boarding Student Leaves]
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
 */
import { Router } from "express";
import * as leaveController from "../../controllers/boarding/leave.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireRole, requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  approveStudentLeaveSchema,
  createStudentLeaveSchema,
  listStudentLeavesSchema,
  rejectStudentLeaveSchema,
  requestLeaveClarificationSchema,
  studentLeaveIdParamSchema,
  updateStudentLeaveSchema,
} from "../../validators/boarding/leave.validator";

export const studentLeaveRoutes = Router();

studentLeaveRoutes.use(verifyToken, requireSchoolAccess);

studentLeaveRoutes.get(
  "/",
  requireRole(
    "school_admin",
    "director_of_discipline",
    "patron",
    "matron",
    "gate_keeper",
  ),
  validate(listStudentLeavesSchema),
  asyncWrapper(leaveController.listStudentLeaves),
);

studentLeaveRoutes.post(
  "/",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate(createStudentLeaveSchema),
  asyncWrapper(leaveController.createStudentLeave),
);

studentLeaveRoutes.get(
  "/:id",
  requireRole(
    "school_admin",
    "director_of_discipline",
    "patron",
    "matron",
    "gate_keeper",
  ),
  validate({ params: studentLeaveIdParamSchema }),
  asyncWrapper(leaveController.getStudentLeave),
);

studentLeaveRoutes.patch(
  "/:id",
  requireRole("school_admin", "director_of_discipline"),
  validate(updateStudentLeaveSchema),
  asyncWrapper(leaveController.updateStudentLeave),
);

studentLeaveRoutes.delete(
  "/:id",
  requireRole("school_admin", "director_of_discipline"),
  validate({ params: studentLeaveIdParamSchema }),
  asyncWrapper(leaveController.deleteStudentLeave),
);

studentLeaveRoutes.patch(
  "/:id/approve",
  requireRole("school_admin", "director_of_discipline"),
  validate(approveStudentLeaveSchema),
  asyncWrapper(leaveController.approveStudentLeave),
);

studentLeaveRoutes.patch(
  "/:id/reject",
  requireRole("school_admin", "director_of_discipline"),
  validate(rejectStudentLeaveSchema),
  asyncWrapper(leaveController.rejectStudentLeave),
);

studentLeaveRoutes.patch(
  "/:id/clarify",
  requireRole("school_admin", "director_of_discipline"),
  validate(requestLeaveClarificationSchema),
  asyncWrapper(leaveController.requestLeaveClarification),
);
