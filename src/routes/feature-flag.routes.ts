/**
 * @swagger
 * tags:
 *   - name: Feature Flags
 *     description: Feature flag management
 *
 * /feature-flags:
 *   get:
 *     summary: List feature flags
 *     tags: [Feature Flags]
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
 *     summary: Create feature flag
 *     tags: [Feature Flags]
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
 * /feature-flags/key/{key}:
 *   get:
 *     summary: Get feature flag by key
 *     tags: [Feature Flags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
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
 * /feature-flags/{id}:
 *   get:
 *     summary: Get feature flag by id
 *     tags: [Feature Flags]
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
 *     summary: Update feature flag
 *     tags: [Feature Flags]
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
 *     summary: Delete feature flag
 *     tags: [Feature Flags]
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
import * as featureFlagController from "../controllers/feature-flag.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyPlatformToken } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { PlatformRole } from "../constants/roles";
import {
  createFeatureFlagSchema,
  featureFlagIdParamSchema,
  featureFlagKeyParamSchema,
  listFeatureFlagsSchema,
  updateFeatureFlagSchema
} from "../validators/feature-flag.validator";

export const featureFlagRoutes = Router();

featureFlagRoutes.use(
  verifyPlatformToken,
  requireRole(PlatformRole.PLATFORM_ADMIN)
);

featureFlagRoutes.get(
  "/",
  validate(listFeatureFlagsSchema),
  asyncWrapper(featureFlagController.listFeatureFlags)
);

featureFlagRoutes.post(
  "/",
  validate(createFeatureFlagSchema),
  asyncWrapper(featureFlagController.createFeatureFlag)
);

featureFlagRoutes.get(
  "/key/:key",
  validate({ params: featureFlagKeyParamSchema }),
  asyncWrapper(featureFlagController.getFeatureFlagByKey)
);

featureFlagRoutes.get(
  "/:id",
  validate({ params: featureFlagIdParamSchema }),
  asyncWrapper(featureFlagController.getFeatureFlag)
);

featureFlagRoutes.patch(
  "/:id",
  validate(updateFeatureFlagSchema),
  asyncWrapper(featureFlagController.updateFeatureFlag)
);

featureFlagRoutes.delete(
  "/:id",
  validate({ params: featureFlagIdParamSchema }),
  asyncWrapper(featureFlagController.deleteFeatureFlag)
);
