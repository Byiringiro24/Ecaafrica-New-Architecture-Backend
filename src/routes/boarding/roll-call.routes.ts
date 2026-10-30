/**
 * @swagger
 * tags:
 *   - name: Boarding Roll Calls
 *     description: Boarding roll call management
 *
 * /boarding/roll-calls:
 *   get:
 *     summary: List roll calls
 *     tags: [Boarding Roll Calls]
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
 *     summary: Create roll call
 *     tags: [Boarding Roll Calls]
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
 * /boarding/roll-calls/{id}:
 *   get:
 *     summary: Get roll call by id
 *     tags: [Boarding Roll Calls]
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
 *     summary: Update roll call
 *     tags: [Boarding Roll Calls]
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
 *     summary: Delete roll call
 *     tags: [Boarding Roll Calls]
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
 * /boarding/roll-calls/{id}/records:
 *   post:
 *     summary: Submit roll call record
 *     tags: [Boarding Roll Calls]
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
 * /boarding/roll-calls/{id}/records/bulk:
 *   post:
 *     summary: Bulk submit roll call records
 *     tags: [Boarding Roll Calls]
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
 * /boarding/roll-calls/{id}/summary:
 *   get:
 *     summary: Get roll call summary
 *     tags: [Boarding Roll Calls]
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
import * as rollCallController from "../../controllers/boarding/roll-call.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireBoardingRole, requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  bulkRollCallRecordSchema,
  createRollCallRecordSchema,
  createRollCallSchema,
  listRollCallsSchema,
  rollCallIdParamSchema,
  updateRollCallSchema,
} from "../../validators/boarding/roll-call.validator";

export const rollCallRoutes = Router();

rollCallRoutes.use(verifyToken, requireSchoolAccess);

rollCallRoutes.get(
  "/",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate(listRollCallsSchema),
  asyncWrapper(rollCallController.listRollCalls),
);

rollCallRoutes.post("/", requireBoardingRole, validate(createRollCallSchema), asyncWrapper(rollCallController.createRollCall));

rollCallRoutes.get(
  "/:id",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate({ params: rollCallIdParamSchema }),
  asyncWrapper(rollCallController.getRollCall),
);

rollCallRoutes.patch(
  "/:id",
  requireBoardingRole,
  validate(updateRollCallSchema),
  asyncWrapper(rollCallController.updateRollCall),
);

rollCallRoutes.delete(
  "/:id",
  requireBoardingRole,
  validate({ params: rollCallIdParamSchema }),
  asyncWrapper(rollCallController.deleteRollCall),
);

rollCallRoutes.post(
  "/:id/records",
  requireBoardingRole,
  validate(createRollCallRecordSchema),
  asyncWrapper(rollCallController.submitRollCallRecord),
);

rollCallRoutes.post(
  "/:id/records/bulk",
  requireBoardingRole,
  validate(bulkRollCallRecordSchema),
  asyncWrapper(rollCallController.bulkSubmitRollCall),
);

rollCallRoutes.get(
  "/:id/summary",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate({ params: rollCallIdParamSchema }),
  asyncWrapper(rollCallController.getRollCallSummary),
);

rollCallRoutes.get(
  "/:id/roster",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate({ params: rollCallIdParamSchema }),
  asyncWrapper(rollCallController.getRollCallRoster),
);

