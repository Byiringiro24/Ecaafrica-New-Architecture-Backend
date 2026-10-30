/**
 * @swagger
 * tags:
 *   - name: Biometrics
 *     description: Biometric enrollment management
 *
 * /biometric-enrollments:
 *   get:
 *     summary: List biometric enrollments
 *     tags: [Biometrics]
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
 *     summary: Create biometric enrollment
 *     tags: [Biometrics]
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
 * /biometric-enrollments/{id}:
 *   get:
 *     summary: Get biometric enrollment by id
 *     tags: [Biometrics]
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
 *     summary: Update biometric enrollment
 *     tags: [Biometrics]
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
 *     summary: Delete biometric enrollment
 *     tags: [Biometrics]
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
import * as biometricController from "../controllers/biometric.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  biometricIdParamSchema,
  createBiometricSchema,
  listBiometricSchema,
  updateBiometricSchema
} from "../validators/biometric.validator";

export const biometricRoutes = Router();

biometricRoutes.use(verifyToken, requireSchoolAccess);

biometricRoutes.get(
  "/",
  validate(listBiometricSchema),
  asyncWrapper(biometricController.listBiometricEnrollments)
);

biometricRoutes.post(
  "/",
  validate(createBiometricSchema),
  asyncWrapper(biometricController.createBiometricEnrollment)
);

biometricRoutes.get(
  "/:id",
  validate({ params: biometricIdParamSchema }),
  asyncWrapper(biometricController.getBiometricEnrollment)
);

biometricRoutes.patch(
  "/:id",
  validate(updateBiometricSchema),
  asyncWrapper(biometricController.updateBiometricEnrollment)
);

biometricRoutes.delete(
  "/:id",
  validate({ params: biometricIdParamSchema }),
  asyncWrapper(biometricController.deleteBiometricEnrollment)
);
