/**
 * @swagger
 * tags:
 *   - name: Boarding Absence Alerts
 *     description: Absence alert management
 *
 * /boarding/absence-alerts:
 *   get:
 *     summary: List absence alerts
 *     tags: [Boarding Absence Alerts]
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
 *     summary: Create absence alert
 *     tags: [Boarding Absence Alerts]
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
 * /boarding/absence-alerts/{id}:
 *   get:
 *     summary: Get absence alert by id
 *     tags: [Boarding Absence Alerts]
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
 *     summary: Update absence alert
 *     tags: [Boarding Absence Alerts]
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
 *     summary: Delete absence alert
 *     tags: [Boarding Absence Alerts]
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
 * /boarding/absence-alerts/{id}/resolve:
 *   patch:
 *     summary: Resolve absence alert
 *     tags: [Boarding Absence Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
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
import * as alertController from "../../controllers/boarding/alert.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireBoardingRole, requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  absenceAlertIdParamSchema,
  createAbsenceAlertSchema,
  listAbsenceAlertsSchema,
  resolveAbsenceAlertSchema,
  updateAbsenceAlertSchema,
} from "../../validators/boarding/alert.validator";

export const absenceAlertRoutes = Router();

absenceAlertRoutes.use(verifyToken, requireSchoolAccess);

absenceAlertRoutes.get(
  "/",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate(listAbsenceAlertsSchema),
  asyncWrapper(alertController.listAlerts),
);

absenceAlertRoutes.post(
  "/",
  requireBoardingRole,
  validate(createAbsenceAlertSchema),
  asyncWrapper(alertController.createAlert),
);

absenceAlertRoutes.get(
  "/:id",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate({ params: absenceAlertIdParamSchema }),
  asyncWrapper(alertController.getAlert),
);

absenceAlertRoutes.patch(
  "/:id",
  requireBoardingRole,
  validate(updateAbsenceAlertSchema),
  asyncWrapper(alertController.updateAlert),
);

absenceAlertRoutes.delete(
  "/:id",
  requireBoardingRole,
  validate({ params: absenceAlertIdParamSchema }),
  asyncWrapper(alertController.deleteAlert),
);

absenceAlertRoutes.patch(
  "/:id/resolve",
  requireBoardingRole,
  validate(resolveAbsenceAlertSchema),
  asyncWrapper(alertController.resolveAlert),
);

