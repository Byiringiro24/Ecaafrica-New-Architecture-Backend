/**
 * @swagger
 * tags:
 *   - name: Timetable Periods
 *     description: Timetable period management
 *
 * /timetable-periods:
 *   get:
 *     summary: List timetable periods
 *     tags: [Timetable Periods]
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
 *     summary: Create timetable period
 *     tags: [Timetable Periods]
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
 * /timetable-periods/{id}:
 *   get:
 *     summary: Get timetable period by id
 *     tags: [Timetable Periods]
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
 *     summary: Update timetable period
 *     tags: [Timetable Periods]
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
 *     summary: Delete timetable period
 *     tags: [Timetable Periods]
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
import * as timetablePeriodController from "../controllers/timetable-period.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createTimetablePeriodSchema,
  listTimetablePeriodsSchema,
  timetablePeriodIdParamSchema,
  updateTimetablePeriodSchema
} from "../validators/timetable-period.validator";

export const timetablePeriodRoutes = Router();

timetablePeriodRoutes.use(verifyToken, requireSchoolAccess);

timetablePeriodRoutes.get(
  "/",
  validate(listTimetablePeriodsSchema),
  asyncWrapper(timetablePeriodController.listTimetablePeriods)
);

timetablePeriodRoutes.post(
  "/",
  validate(createTimetablePeriodSchema),
  asyncWrapper(timetablePeriodController.createTimetablePeriod)
);

timetablePeriodRoutes.get(
  "/:id",
  validate({ params: timetablePeriodIdParamSchema }),
  asyncWrapper(timetablePeriodController.getTimetablePeriod)
);

timetablePeriodRoutes.patch(
  "/:id",
  validate(updateTimetablePeriodSchema),
  asyncWrapper(timetablePeriodController.updateTimetablePeriod)
);

timetablePeriodRoutes.delete(
  "/:id",
  validate({ params: timetablePeriodIdParamSchema }),
  asyncWrapper(timetablePeriodController.deleteTimetablePeriod)
);
