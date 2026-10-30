/**
 * @swagger
 * tags:
 *   - name: Boarding Dormitories
 *     description: Dormitory management
 *
 * /boarding/dormitories:
 *   get:
 *     summary: List dormitories
 *     tags: [Boarding Dormitories]
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
 *     summary: Create dormitory
 *     tags: [Boarding Dormitories]
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
 * /boarding/dormitories/{id}:
 *   get:
 *     summary: Get dormitory by id
 *     tags: [Boarding Dormitories]
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
 *     summary: Update dormitory
 *     tags: [Boarding Dormitories]
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
 *     summary: Delete dormitory
 *     tags: [Boarding Dormitories]
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
import * as dormitoryController from "../../controllers/boarding/dormitory.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireBoardingRole, requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  createDormitorySchema,
  dormitoryIdParamSchema,
  listDormitoriesSchema,
  updateDormitorySchema,
} from "../../validators/boarding/dormitory.validator";

export const dormitoryRoutes = Router();

dormitoryRoutes.use(verifyToken, requireSchoolAccess);

dormitoryRoutes.get(
  "/",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate(listDormitoriesSchema),
  asyncWrapper(dormitoryController.listDormitories),
);

dormitoryRoutes.post(
  "/",
  requireBoardingRole,
  validate(createDormitorySchema),
  asyncWrapper(dormitoryController.createDormitory),
);

dormitoryRoutes.get(
  "/:id",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate({ params: dormitoryIdParamSchema }),
  asyncWrapper(dormitoryController.getDormitory),
);

dormitoryRoutes.patch(
  "/:id",
  requireBoardingRole,
  validate(updateDormitorySchema),
  asyncWrapper(dormitoryController.updateDormitory),
);

dormitoryRoutes.delete(
  "/:id",
  requireBoardingRole,
  validate({ params: dormitoryIdParamSchema }),
  asyncWrapper(dormitoryController.deleteDormitory),
);

