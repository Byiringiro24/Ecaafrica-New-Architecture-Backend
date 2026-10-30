/**
 * @swagger
 * tags:
 *   - name: System Settings
 *     description: School system settings
 *
 * /system-settings:
 *   get:
 *     summary: List system settings
 *     tags: [System Settings]
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
 *     summary: Create system setting
 *     tags: [System Settings]
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
 * /system-settings/key/{key}:
 *   get:
 *     summary: Get system setting by key
 *     tags: [System Settings]
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
 * /system-settings/{id}:
 *   get:
 *     summary: Get system setting by id
 *     tags: [System Settings]
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
 *     summary: Update system setting
 *     tags: [System Settings]
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
 *     summary: Delete system setting
 *     tags: [System Settings]
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
 *
 * /system-settings/key/{key}/update:
 *   patch:
 *     summary: Update system setting by key
 *     tags: [System Settings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
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
 */
import { Router } from "express";
import * as systemSettingsController from "../controllers/system-settings.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess, requireRole } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createSystemSettingSchema,
  listSystemSettingsSchema,
  systemSettingIdParamSchema,
  systemSettingKeyParamSchema,
  updateSystemSettingByKeySchema,
  updateSystemSettingSchema
} from "../validators/system-settings.validator";

export const systemSettingsRoutes = Router();

systemSettingsRoutes.use(verifyToken, requireSchoolAccess, requireRole("school_admin"));

systemSettingsRoutes.get(
  "/",
  validate(listSystemSettingsSchema),
  asyncWrapper(systemSettingsController.listSettings)
);

systemSettingsRoutes.post(
  "/",
  validate(createSystemSettingSchema),
  asyncWrapper(systemSettingsController.createSetting)
);

systemSettingsRoutes.get(
  "/key/:key",
  validate({ params: systemSettingKeyParamSchema }),
  asyncWrapper(systemSettingsController.getSettingByKey)
);

systemSettingsRoutes.get(
  "/:id",
  validate({ params: systemSettingIdParamSchema }),
  asyncWrapper(systemSettingsController.getSetting)
);

systemSettingsRoutes.patch(
  "/:id",
  validate(updateSystemSettingSchema),
  asyncWrapper(systemSettingsController.updateSetting)
);

systemSettingsRoutes.patch(
  "/key/:key",
  validate(updateSystemSettingByKeySchema),
  asyncWrapper(systemSettingsController.updateSettingByKey)
);

systemSettingsRoutes.delete(
  "/:id",
  validate({ params: systemSettingIdParamSchema }),
  asyncWrapper(systemSettingsController.deleteSetting)
);
