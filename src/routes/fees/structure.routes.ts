/**
 * @swagger
 * tags:
 *   - name: Fee Structures
 *     description: Fee structure management
 *
 * /fees/structures:
 *   get:
 *     summary: List fee structures
 *     tags: [Fee Structures]
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
 *     summary: Create fee structure
 *     tags: [Fee Structures]
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
 * /fees/structures/{id}/clone:
 *   post:
 *     summary: Clone fee structure
 *     tags: [Fee Structures]
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
 *
 * /fees/structures/{id}:
 *   get:
 *     summary: Get fee structure by id
 *     tags: [Fee Structures]
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
 *     summary: Update fee structure
 *     tags: [Fee Structures]
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
 *     summary: Delete fee structure
 *     tags: [Fee Structures]
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
import * as structureController from "../../controllers/fees/structure.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  cloneFeeStructureSchema,
  createFeeStructureSchema,
  feeStructureIdParamSchema,
  listFeeStructuresSchema,
  updateFeeStructureSchema
} from "../../validators/fees/structure.validator";

export const feeStructureRoutes = Router();

feeStructureRoutes.get(
  "/",
  validate(listFeeStructuresSchema),
  asyncWrapper(structureController.listFeeStructures)
);

feeStructureRoutes.post(
  "/",
  validate(createFeeStructureSchema),
  asyncWrapper(structureController.createFeeStructure)
);

feeStructureRoutes.post(
  "/:id/clone",
  validate(cloneFeeStructureSchema),
  asyncWrapper(structureController.cloneFeeStructure)
);

feeStructureRoutes.get(
  "/:id",
  validate({ params: feeStructureIdParamSchema }),
  asyncWrapper(structureController.getFeeStructure)
);

feeStructureRoutes.patch(
  "/:id",
  validate(updateFeeStructureSchema),
  asyncWrapper(structureController.updateFeeStructure)
);

feeStructureRoutes.delete(
  "/:id",
  validate({ params: feeStructureIdParamSchema }),
  asyncWrapper(structureController.deleteFeeStructure)
);
