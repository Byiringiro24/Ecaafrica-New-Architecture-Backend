/**
 * @swagger
 * tags:
 *   - name: Fee Assignments
 *     description: Fee assignment management
 *
 * /fees/assignments/bulk:
 *   post:
 *     summary: Bulk assign fees
 *     tags: [Fee Assignments]
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
 * /fees/assignments:
 *   get:
 *     summary: List fee assignments
 *     tags: [Fee Assignments]
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
 *     summary: Create fee assignment
 *     tags: [Fee Assignments]
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
 * /fees/assignments/{id}:
 *   get:
 *     summary: Get fee assignment by id
 *     tags: [Fee Assignments]
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
 *     summary: Update fee assignment
 *     tags: [Fee Assignments]
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
 *     summary: Delete fee assignment
 *     tags: [Fee Assignments]
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
import * as assignmentController from "../../controllers/fees/assignment.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  bulkAssignFeeSchema,
  createFeeAssignmentSchema,
  feeAssignmentIdParamSchema,
  listFeeAssignmentsSchema,
  updateFeeAssignmentSchema
} from "../../validators/fees/assignment.validator";

export const feeAssignmentRoutes = Router();

feeAssignmentRoutes.post(
  "/bulk",
  validate(bulkAssignFeeSchema),
  asyncWrapper(assignmentController.bulkAssign)
);

feeAssignmentRoutes.get(
  "/",
  validate(listFeeAssignmentsSchema),
  asyncWrapper(assignmentController.listAssignments)
);

feeAssignmentRoutes.post(
  "/",
  validate(createFeeAssignmentSchema),
  asyncWrapper(assignmentController.createAssignment)
);

feeAssignmentRoutes.get(
  "/:id",
  validate({ params: feeAssignmentIdParamSchema }),
  asyncWrapper(assignmentController.getAssignment)
);

feeAssignmentRoutes.patch(
  "/:id",
  validate(updateFeeAssignmentSchema),
  asyncWrapper(assignmentController.updateAssignment)
);

feeAssignmentRoutes.delete(
  "/:id",
  validate({ params: feeAssignmentIdParamSchema }),
  asyncWrapper(assignmentController.deleteAssignment)
);
