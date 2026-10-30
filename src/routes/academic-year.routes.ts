/**
 * @swagger
 * tags:
 *   - name: Academic Years
 *     description: Academic year management
 *
 * /academic-years:
 *   get:
 *     summary: List academic years
 *     tags: [Academic Years]
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
 *     summary: Create academic year
 *     tags: [Academic Years]
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
 * /academic-years/{id}:
 *   get:
 *     summary: Get academic year by id
 *     tags: [Academic Years]
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
 *     summary: Update academic year
 *     tags: [Academic Years]
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
 *     summary: Delete academic year
 *     tags: [Academic Years]
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
import * as academicYearController from "../controllers/academic-year.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess, requireRole } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  academicYearIdParamSchema,
  createAcademicYearSchema,
  listAcademicYearsSchema,
  updateAcademicYearSchema
} from "../validators/academic-year.validator";

export const academicYearRoutes = Router();

academicYearRoutes.use(verifyToken, requireSchoolAccess);

academicYearRoutes.get(
  "/",
  validate(listAcademicYearsSchema),
  asyncWrapper(academicYearController.listAcademicYears)
);

academicYearRoutes.post(
  "/",
  requireRole("school_admin", "director_of_studies"),
  validate(createAcademicYearSchema),
  asyncWrapper(academicYearController.createAcademicYear)
);

academicYearRoutes.get(
  "/:id",
  validate({ params: academicYearIdParamSchema }),
  asyncWrapper(academicYearController.getAcademicYear)
);

academicYearRoutes.patch(
  "/:id",
  requireRole("school_admin", "director_of_studies"),
  validate(updateAcademicYearSchema),
  asyncWrapper(academicYearController.updateAcademicYear)
);

academicYearRoutes.delete(
  "/:id",
  requireRole("school_admin", "director_of_studies"),
  validate({ params: academicYearIdParamSchema }),
  asyncWrapper(academicYearController.deleteAcademicYear)
);
