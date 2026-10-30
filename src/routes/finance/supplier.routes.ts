/**
 * @swagger
 * tags:
 *   - name: Finance Suppliers
 *     description: Supplier directory and outstanding payables
 *
 * /finance/suppliers:
 *   get:
 *     summary: List suppliers
 *     tags: [Finance Suppliers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: is_active
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *   post:
 *     summary: Add a supplier
 *     tags: [Finance Suppliers]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       201: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *
 * /finance/suppliers/{id}:
 *   get:
 *     summary: Get supplier by id
 *     tags: [Finance Suppliers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *   patch:
 *     summary: Update a supplier
 *     tags: [Finance Suppliers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *   delete:
 *     summary: Soft delete a supplier
 *     tags: [Finance Suppliers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       409: { $ref: "#/components/responses/Conflict" }
 */
import { Router } from "express";
import * as inventoryController from "../../controllers/finance/inventory.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  createSupplierSchema,
  listSuppliersSchema,
  supplierIdParamSchema,
  updateSupplierSchema
} from "../../validators/finance/inventory.validator";

export const supplierRoutes = Router();

supplierRoutes.get(
  "/",
  validate(listSuppliersSchema),
  asyncWrapper(inventoryController.listSuppliers)
);

supplierRoutes.post(
  "/",
  validate(createSupplierSchema),
  asyncWrapper(inventoryController.createSupplier)
);

supplierRoutes.get(
  "/:id",
  validate({ params: supplierIdParamSchema }),
  asyncWrapper(inventoryController.getSupplier)
);

supplierRoutes.patch(
  "/:id",
  validate(updateSupplierSchema),
  asyncWrapper(inventoryController.updateSupplier)
);

supplierRoutes.delete(
  "/:id",
  validate({ params: supplierIdParamSchema }),
  asyncWrapper(inventoryController.deleteSupplier)
);
