/**
 * @swagger
 * tags:
 *   - name: Platform Plans
 *     description: Platform subscription plans
 *
 * /platform/plans:
 *   get:
 *     summary: List plans
 *     tags: [Platform Plans]
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
 *     summary: Create plan
 *     tags: [Platform Plans]
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
 * /platform/plans/{id}:
 *   get:
 *     summary: Get plan by id
 *     tags: [Platform Plans]
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
 *     summary: Update plan
 *     tags: [Platform Plans]
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
 *     summary: Delete plan
 *     tags: [Platform Plans]
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
import * as planController from "../../controllers/platform/plan.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyPlatformToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { PlatformRole } from "../../constants/roles";
import {
  createPlanSchema,
  listPlansSchema,
  planIdParamSchema,
  updatePlanSchema
} from "../../validators/platform/plan.validator";

export const planRoutes = Router();

planRoutes.use(verifyPlatformToken, requireRole(PlatformRole.PLATFORM_ADMIN));

planRoutes.get("/", validate(listPlansSchema), asyncWrapper(planController.listPlans));

planRoutes.post("/", validate(createPlanSchema), asyncWrapper(planController.createPlan));

planRoutes.get(
  "/:id",
  validate({ params: planIdParamSchema }),
  asyncWrapper(planController.getPlan)
);

planRoutes.patch("/:id", validate(updatePlanSchema), asyncWrapper(planController.updatePlan));

planRoutes.delete(
  "/:id",
  validate({ params: planIdParamSchema }),
  asyncWrapper(planController.deletePlan)
);
