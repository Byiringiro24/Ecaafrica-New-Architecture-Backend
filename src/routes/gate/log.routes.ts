/**
 * @swagger
 * tags:
 *   - name: Gate Logs
 *     description: Gate log events
 *
 * /gate/logs:
 *   get:
 *     summary: List gate logs
 *     tags: [Gate Logs]
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
 *     summary: Create gate log
 *     tags: [Gate Logs]
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
 * /gate/logs/active-on-campus:
 *   get:
 *     summary: Get active students on campus
 *     tags: [Gate Logs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /gate/logs/{id}:
 *   get:
 *     summary: Get gate log by id
 *     tags: [Gate Logs]
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
 *     summary: Update gate log
 *     tags: [Gate Logs]
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
 *     summary: Delete gate log
 *     tags: [Gate Logs]
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
import * as gateLogController from "../../controllers/gate/log.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  createGateLogSchema,
  gateLogIdParamSchema,
  listGateLogsSchema,
  updateGateLogSchema
} from "../../validators/gate/log.validator";

export const gateLogRoutes = Router();

gateLogRoutes.use(verifyToken, requireSchoolAccess);

gateLogRoutes.get("/", validate(listGateLogsSchema), asyncWrapper(gateLogController.listGateLogs));

gateLogRoutes.post(
  "/",
  validate(createGateLogSchema),
  asyncWrapper(gateLogController.createGateLog)
);

gateLogRoutes.get(
  "/active-on-campus",
  asyncWrapper(gateLogController.getActiveStudentsOnCampus)
);

gateLogRoutes.get(
  "/:id",
  validate({ params: gateLogIdParamSchema }),
  asyncWrapper(gateLogController.getGateLog)
);

gateLogRoutes.patch(
  "/:id",
  validate(updateGateLogSchema),
  asyncWrapper(gateLogController.updateGateLog)
);

gateLogRoutes.delete(
  "/:id",
  validate({ params: gateLogIdParamSchema }),
  asyncWrapper(gateLogController.deleteGateLog)
);
