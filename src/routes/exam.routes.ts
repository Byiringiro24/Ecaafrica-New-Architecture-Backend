/**
 * @swagger
 * tags:
 *   - name: Exams
 *     description: Exam management
 *
 * /exams:
 *   get:
 *     summary: List exams
 *     tags: [Exams]
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
 *     summary: Create exam
 *     tags: [Exams]
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
 * /exams/{id}:
 *   get:
 *     summary: Get exam by id
 *     tags: [Exams]
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
 *     summary: Update exam
 *     tags: [Exams]
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
 *     summary: Delete exam
 *     tags: [Exams]
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
import * as examController from "../controllers/exam.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireRole, requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createExamSchema,
  examIdParamSchema,
  listExamsSchema,
  updateExamSchema
} from "../validators/exam.validator";

export const examRoutes = Router();

examRoutes.use(verifyToken, requireSchoolAccess);

// Teacher-specific routes
examRoutes.get("/teacher/exams", asyncWrapper(examController.listTeacherExams));
examRoutes.get("/teacher/assignments", asyncWrapper(examController.getTeacherAssignments));

// General exam routes
examRoutes.get("/", validate(listExamsSchema), asyncWrapper(examController.listExams));

const canManageExams = requireRole("teacher", "school_admin", "director_of_studies");

examRoutes.post(
  "/",
  canManageExams,
  validate(createExamSchema),
  asyncWrapper(examController.createExam)
);

examRoutes.get(
  "/:id",
  validate({ params: examIdParamSchema }),
  asyncWrapper(examController.getExam)
);

examRoutes.patch(
  "/:id",
  canManageExams,
  validate(updateExamSchema),
  asyncWrapper(examController.updateExam)
);

examRoutes.delete(
  "/:id",
  canManageExams,
  validate({ params: examIdParamSchema }),
  asyncWrapper(examController.deleteExam)
);
