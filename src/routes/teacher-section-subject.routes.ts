/**
 * @swagger
 * tags:
 *   - name: Teacher Section Subjects
 *     description: Teacher-section-subject assignments
 *
 * /teacher-section-subjects:
 *   get:
 *     summary: List teacher section subjects
 *     tags: [Teacher Section Subjects]
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
 *     summary: Create teacher section subject
 *     tags: [Teacher Section Subjects]
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
 * /teacher-section-subjects/{id}:
 *   get:
 *     summary: Get teacher section subject by id
 *     tags: [Teacher Section Subjects]
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
 *     summary: Update teacher section subject
 *     tags: [Teacher Section Subjects]
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
 *     summary: Delete teacher section subject
 *     tags: [Teacher Section Subjects]
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
import * as teacherSectionSubjectController from "../controllers/teacher-section-subject.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createTeacherSectionSubjectSchema,
  listTeacherSectionSubjectsSchema,
  teacherSectionSubjectIdParamSchema,
  updateTeacherSectionSubjectSchema
} from "../validators/teacher-section-subject.validator";

export const teacherSectionSubjectRoutes = Router();

teacherSectionSubjectRoutes.use(verifyToken, requireSchoolAccess);

teacherSectionSubjectRoutes.get(
  "/",
  validate(listTeacherSectionSubjectsSchema),
  asyncWrapper(teacherSectionSubjectController.listTeacherSectionSubjects)
);

teacherSectionSubjectRoutes.post(
  "/",
  validate(createTeacherSectionSubjectSchema),
  asyncWrapper(teacherSectionSubjectController.createTeacherSectionSubject)
);

teacherSectionSubjectRoutes.get(
  "/:id",
  validate({ params: teacherSectionSubjectIdParamSchema }),
  asyncWrapper(teacherSectionSubjectController.getTeacherSectionSubject)
);

teacherSectionSubjectRoutes.patch(
  "/:id",
  validate(updateTeacherSectionSubjectSchema),
  asyncWrapper(teacherSectionSubjectController.updateTeacherSectionSubject)
);

teacherSectionSubjectRoutes.delete(
  "/:id",
  validate({ params: teacherSectionSubjectIdParamSchema }),
  asyncWrapper(teacherSectionSubjectController.deleteTeacherSectionSubject)
);
