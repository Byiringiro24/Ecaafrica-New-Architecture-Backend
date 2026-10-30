/**
 * @swagger
 * tags:
 *   - name: Platform SMS Providers
 *     description: SMS provider management
 *
 * /platform/sms-providers:
 *   get:
 *     summary: List SMS providers
 *     tags: [Platform SMS Providers]
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
 *     summary: Create SMS provider
 *     tags: [Platform SMS Providers]
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
 * /platform/sms-providers/{id}:
 *   get:
 *     summary: Get SMS provider by id
 *     tags: [Platform SMS Providers]
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
 *     summary: Update SMS provider
 *     tags: [Platform SMS Providers]
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
 *     summary: Delete SMS provider
 *     tags: [Platform SMS Providers]
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
import * as smsProviderController from "../../controllers/platform/sms-provider.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyPlatformToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { PlatformRole } from "../../constants/roles";
import {
  createSmsProviderSchema,
  listSmsProvidersSchema,
  smsProviderIdParamSchema,
  updateSmsProviderSchema
} from "../../validators/platform/sms-provider.validator";

export const smsProviderRoutes = Router();

smsProviderRoutes.use(
  verifyPlatformToken,
  requireRole(PlatformRole.PLATFORM_ADMIN)
);

smsProviderRoutes.get(
  "/",
  validate(listSmsProvidersSchema),
  asyncWrapper(smsProviderController.listSmsProviders)
);

smsProviderRoutes.post(
  "/",
  validate(createSmsProviderSchema),
  asyncWrapper(smsProviderController.createSmsProvider)
);

smsProviderRoutes.get(
  "/:id",
  validate({ params: smsProviderIdParamSchema }),
  asyncWrapper(smsProviderController.getSmsProvider)
);

smsProviderRoutes.patch(
  "/:id",
  validate(updateSmsProviderSchema),
  asyncWrapper(smsProviderController.updateSmsProvider)
);

smsProviderRoutes.delete(
  "/:id",
  validate({ params: smsProviderIdParamSchema }),
  asyncWrapper(smsProviderController.deleteSmsProvider)
);
