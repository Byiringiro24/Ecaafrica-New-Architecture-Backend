/**
 * @swagger
 * tags:
 *   - name: Notification Templates
 *     description: Notification template management
 *
 * /notifications/templates:
 *   get:
 *     summary: List notification templates
 *     tags: [Notification Templates]
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
 *     summary: Create notification template
 *     tags: [Notification Templates]
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
 * /notifications/templates/{id}/render:
 *   post:
 *     summary: Render notification template
 *     tags: [Notification Templates]
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
 *
 * /notifications/templates/{id}:
 *   get:
 *     summary: Get notification template by id
 *     tags: [Notification Templates]
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
 *     summary: Update notification template
 *     tags: [Notification Templates]
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
 *     summary: Delete notification template
 *     tags: [Notification Templates]
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
import * as templateController from "../../controllers/notification/template.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyTokenOrPlatform } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createTemplateSchema,
  listTemplatesSchema,
  renderTemplateSchema,
  templateIdParamSchema,
  updateTemplateSchema
} from "../../validators/notification/template.validator";

export const notificationTemplateRoutes = Router();

notificationTemplateRoutes.use(verifyTokenOrPlatform);

notificationTemplateRoutes.get(
  "/",
  validate(listTemplatesSchema),
  asyncWrapper(templateController.listTemplates)
);

notificationTemplateRoutes.post(
  "/",
  validate(createTemplateSchema),
  asyncWrapper(templateController.createTemplate)
);

notificationTemplateRoutes.post(
  "/:id/render",
  validate(renderTemplateSchema),
  asyncWrapper(templateController.renderTemplate)
);

notificationTemplateRoutes.get(
  "/pending",
  asyncWrapper(templateController.listPendingTemplates)
);

notificationTemplateRoutes.get(
  "/:id",
  validate({ params: templateIdParamSchema }),
  asyncWrapper(templateController.getTemplate)
);

notificationTemplateRoutes.patch(
  "/:id/approve",
  asyncWrapper(templateController.approveTemplate)
);

notificationTemplateRoutes.patch(
  "/:id/reject",
  asyncWrapper(templateController.rejectTemplate)
);

notificationTemplateRoutes.patch(
  "/:id",
  validate(updateTemplateSchema),
  asyncWrapper(templateController.updateTemplate)
);

notificationTemplateRoutes.delete(
  "/:id",
  validate({ params: templateIdParamSchema }),
  asyncWrapper(templateController.deleteTemplate)
);
