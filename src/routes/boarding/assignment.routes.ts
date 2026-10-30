/**
 * @swagger
 * tags:
 *   - name: Boarding Assignments
 *     description: Student dorm assignments
 *
 * /boarding/assignments:
 *   get:
 *     summary: List dorm assignments
 *     tags: [Boarding Assignments]
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
 *     summary: Create dorm assignment
 *     tags: [Boarding Assignments]
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
 * /boarding/assignments/{id}:
 *   get:
 *     summary: Get dorm assignment by id
 *     tags: [Boarding Assignments]
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
 *     summary: Update dorm assignment
 *     tags: [Boarding Assignments]
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
 *     summary: Delete dorm assignment
 *     tags: [Boarding Assignments]
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
import * as assignmentController from "../../controllers/boarding/assignment.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireBoardingRole, requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  createDormAssignmentSchema,
  createDormAssignmentsSchema,
  dormAssignmentIdParamSchema,
  listDormAssignmentsSchema,
  updateDormAssignmentSchema,
} from "../../validators/boarding/assignment.validator";

export const dormAssignmentRoutes = Router();

dormAssignmentRoutes.use(verifyToken, requireSchoolAccess);

dormAssignmentRoutes.get(
  "/",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate(listDormAssignmentsSchema),
  asyncWrapper(assignmentController.listDormAssignments),
);

dormAssignmentRoutes.get(
  "/assignable-students",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  asyncWrapper(assignmentController.listBoardingStudentsForAssignment),
);

dormAssignmentRoutes.post(
  "/batch",
  requireBoardingRole,
  validate(createDormAssignmentsSchema),
  asyncWrapper(assignmentController.createDormAssignments),
);

dormAssignmentRoutes.post(
  "/",
  requireBoardingRole,
  validate(createDormAssignmentSchema),
  asyncWrapper(assignmentController.createDormAssignment),
);

dormAssignmentRoutes.get(
  "/:id",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate({ params: dormAssignmentIdParamSchema }),
  asyncWrapper(assignmentController.getDormAssignment),
);

dormAssignmentRoutes.patch(
  "/:id",
  requireBoardingRole,
  validate(updateDormAssignmentSchema),
  asyncWrapper(assignmentController.updateDormAssignment),
);

dormAssignmentRoutes.delete(
  "/:id",
  requireBoardingRole,
  validate({ params: dormAssignmentIdParamSchema }),
  asyncWrapper(assignmentController.deleteDormAssignment),
);

