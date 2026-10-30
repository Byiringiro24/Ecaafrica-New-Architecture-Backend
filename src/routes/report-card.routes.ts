/**
 * @swagger
 * tags:
 *   - name: Report Cards
 *     description: Student report card generation
 *
 * /report-cards/student/{studentId}:
 *   get:
 *     summary: Get a single student's report card for a term
 *     tags: [Report Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: term_id
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /report-cards/section/{sectionId}:
 *   get:
 *     summary: Get report cards for every student in a section
 *     tags: [Report Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: term_id
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
import * as reportCardController from "../controllers/report-card.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireRole, requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  sectionReportCardSchema,
  studentReportCardSchema
} from "../validators/report-card.validator";

export const reportCardRoutes = Router();

reportCardRoutes.use(verifyToken, requireSchoolAccess, requireRole("school_admin", "director_of_studies"));

reportCardRoutes.get(
  "/student/:studentId",
  validate(studentReportCardSchema),
  asyncWrapper(reportCardController.getStudentReportCard)
);

reportCardRoutes.get(
  "/section/:sectionId",
  validate(sectionReportCardSchema),
  asyncWrapper(reportCardController.getSectionReportCards)
);

reportCardRoutes.post(
  "/section/:sectionId/publish",
  validate(sectionReportCardSchema),
  asyncWrapper(reportCardController.publishSectionReportCards)
);
