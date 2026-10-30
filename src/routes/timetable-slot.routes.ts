/**
 * @swagger
 * tags:
 *   - name: Timetable Slots
 *     description: Timetable slot management
 *
 * /timetable-slots:
 *   get:
 *     summary: List timetable slots
 *     tags: [Timetable Slots]
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
 *     summary: Create timetable slot
 *     tags: [Timetable Slots]
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
 * /timetable-slots/{id}:
 *   get:
 *     summary: Get timetable slot by id
 *     tags: [Timetable Slots]
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
 *     summary: Update timetable slot
 *     tags: [Timetable Slots]
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
 *     summary: Delete timetable slot
 *     tags: [Timetable Slots]
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
import * as timetableSlotController from "../controllers/timetable-slot.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  bulkCreateTimetableSlotsSchema,
  copyLegacyTimetableSchema,
  createTimetableSlotSchema,
  generateTimetableSlotsSchema,
  listTimetableSlotsSchema,
  timetableSlotIdParamSchema,
  updateTimetableSlotSchema
} from "../validators/timetable-slot.validator";

export const timetableSlotRoutes = Router();

timetableSlotRoutes.use(verifyToken, requireSchoolAccess);

timetableSlotRoutes.get(
  "/",
  validate(listTimetableSlotsSchema),
  asyncWrapper(timetableSlotController.listTimetableSlots)
);

timetableSlotRoutes.post(
  "/",
  validate(createTimetableSlotSchema),
  asyncWrapper(timetableSlotController.createTimetableSlot)
);

// POST /timetable-slots/bulk — combined-class: one slot per section, same teacher/period/day
// Must be before /:id so Express doesn't treat "bulk" as an id param
timetableSlotRoutes.post(
  "/bulk",
  validate(bulkCreateTimetableSlotsSchema),
  asyncWrapper(timetableSlotController.bulkCreateTimetableSlots)
);

// POST /timetable-slots/generate — DOS auto-fill: weekly template → all slots
// Must be before /:id so Express doesn't treat "generate" as an id param
timetableSlotRoutes.post(
  "/copy-legacy",
  validate(copyLegacyTimetableSchema),
  asyncWrapper(timetableSlotController.copyLegacyTimetable)
);

timetableSlotRoutes.post(
  "/generate",
  validate(generateTimetableSlotsSchema),
  asyncWrapper(timetableSlotController.generateTimetableSlots)
);

timetableSlotRoutes.get(
  "/:id",
  validate({ params: timetableSlotIdParamSchema }),
  asyncWrapper(timetableSlotController.getTimetableSlot)
);

timetableSlotRoutes.patch(
  "/:id",
  validate(updateTimetableSlotSchema),
  asyncWrapper(timetableSlotController.updateTimetableSlot)
);

timetableSlotRoutes.delete(
  "/:id",
  validate({ params: timetableSlotIdParamSchema }),
  asyncWrapper(timetableSlotController.deleteTimetableSlot)
);
