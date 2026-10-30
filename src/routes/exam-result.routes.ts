/**
 * @swagger
 * tags:
 *   - name: Exam Results
 *     description: Exam result management
 *
 * /exam-results/bulk:
 *   post:
 *     summary: Bulk record exam results
 *     tags: [Exam Results]
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
 * /exam-results/summary/{examId}:
 *   get:
 *     summary: Get exam summary
 *     tags: [Exam Results]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
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
 * /exam-results/by-student/{studentId}:
 *   get:
 *     summary: Get results by student
 *     tags: [Exam Results]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
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
 * /exam-results/by-exam/{examId}:
 *   get:
 *     summary: Get results by exam
 *     tags: [Exam Results]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
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
 * /exam-results:
 *   get:
 *     summary: List exam results
 *     tags: [Exam Results]
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
 *     summary: Create exam result
 *     tags: [Exam Results]
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
 * /exam-results/{id}:
 *   get:
 *     summary: Get exam result by id
 *     tags: [Exam Results]
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
 *     summary: Update exam result
 *     tags: [Exam Results]
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
 *     summary: Delete exam result
 *     tags: [Exam Results]
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
import * as examResultController from "../controllers/exam-result.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireRole, requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  bulkRecordExamResultsSchema,
  createExamResultSchema,
  examIdParamSchema,
  examResultIdParamSchema,
  listExamResultsSchema,
  studentIdParamSchema,
  updateExamResultSchema
} from "../validators/exam-result.validator";

export const examResultRoutes = Router();

examResultRoutes.use(verifyToken, requireSchoolAccess);

const canRecordMarks = requireRole("teacher", "school_admin", "director_of_studies");
const canPublish = requireRole("school_admin", "director_of_studies");

examResultRoutes.post(
  "/bulk",
  canRecordMarks,
  validate(bulkRecordExamResultsSchema),
  asyncWrapper(examResultController.bulkRecordResults)
);

examResultRoutes.post(
  "/publish/:examId",
  canPublish,
  validate({ params: examIdParamSchema }),
  asyncWrapper(examResultController.publishResults)
);

examResultRoutes.post(
  "/unpublish/:examId",
  canPublish,
  validate({ params: examIdParamSchema }),
  asyncWrapper(examResultController.unpublishResults)
);

examResultRoutes.get(
  "/summary/:examId",
  validate({ params: examIdParamSchema }),
  asyncWrapper(examResultController.getExamSummary)
);

examResultRoutes.get(
  "/by-student/:studentId",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(examResultController.getResultsByStudent)
);

examResultRoutes.get(
  "/by-exam/:examId",
  validate({ params: examIdParamSchema }),
  asyncWrapper(examResultController.getResultsByExam)
);

examResultRoutes.get(
  "/",
  validate(listExamResultsSchema),
  asyncWrapper(examResultController.listResults)
);

examResultRoutes.post(
  "/",
  canRecordMarks,
  validate(createExamResultSchema),
  asyncWrapper(examResultController.createResult)
);

examResultRoutes.get(
  "/:id",
  validate({ params: examResultIdParamSchema }),
  asyncWrapper(examResultController.getResult)
);

examResultRoutes.patch(
  "/:id",
  canRecordMarks,
  validate(updateExamResultSchema),
  asyncWrapper(examResultController.updateResult)
);

examResultRoutes.delete(
  "/:id",
  canRecordMarks,
  validate({ params: examResultIdParamSchema }),
  asyncWrapper(examResultController.deleteResult)
);
