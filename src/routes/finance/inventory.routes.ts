/**
 * @swagger
 * tags:
 *   - name: Finance Inventory
 *     description: Stock, valuation and purchase requests
 *
 * /finance/inventory:
 *   get:
 *     summary: List inventory items with stock valuation
 *     tags: [Finance Inventory]
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
 *         name: status
 *         schema: { type: string, enum: [requested, ordered, received, invoiced, cancelled] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: supplier_id
 *         schema: { type: string }
 *       - in: query
 *         name: low_stock
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *   post:
 *     summary: Create a purchase request / stock item
 *     tags: [Finance Inventory]
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
 * /finance/inventory/{id}:
 *   get:
 *     summary: Get inventory item by id
 *     tags: [Finance Inventory]
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
 *     summary: Update an inventory item
 *     tags: [Finance Inventory]
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
 *     summary: Soft delete an inventory item
 *     tags: [Finance Inventory]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *
 * /finance/inventory/{id}/status:
 *   patch:
 *     summary: Advance the purchase request lifecycle
 *     description: requested -> ordered -> received -> invoiced. Cancellation is allowed from requested or ordered.
 *     tags: [Finance Inventory]
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
 *
 * /finance/inventory/{id}/invoice:
 *   post:
 *     summary: Upload the supplier invoice for an inventory item
 *     tags: [Finance Inventory]
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
 */
import { Router } from "express";
import { uploadPaymentReceipt } from "../../configs/multer";
import * as inventoryController from "../../controllers/finance/inventory.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  createInventoryItemSchema,
  inventoryIdParamSchema,
  createInventoryCategorySchema,
  listInventorySchema,
  updateInventoryItemSchema,
  updateInventoryStatusSchema,
  paySupplierSchema
} from "../../validators/finance/inventory.validator";

export const inventoryRoutes = Router();

inventoryRoutes.get(
  "/",
  validate(listInventorySchema),
  asyncWrapper(inventoryController.listInventoryItems)
);

inventoryRoutes.get("/categories", asyncWrapper(inventoryController.listInventoryCategories));
inventoryRoutes.post(
  "/categories",
  validate(createInventoryCategorySchema),
  asyncWrapper(inventoryController.createInventoryCategory)
);

inventoryRoutes.post(
  "/",
  validate(createInventoryItemSchema),
  asyncWrapper(inventoryController.createInventoryItem)
);

inventoryRoutes.get(
  "/:id",
  validate({ params: inventoryIdParamSchema }),
  asyncWrapper(inventoryController.getInventoryItem)
);

inventoryRoutes.patch(
  "/:id",
  validate(updateInventoryItemSchema),
  asyncWrapper(inventoryController.updateInventoryItem)
);

inventoryRoutes.patch(
  "/:id/status",
  validate(updateInventoryStatusSchema),
  asyncWrapper(inventoryController.updateInventoryStatus)
);

inventoryRoutes.post(
  "/:id/pay-supplier",
  validate(paySupplierSchema),
  asyncWrapper(inventoryController.paySupplier)
);

inventoryRoutes.post(
  "/:id/invoice",
  validate({ params: inventoryIdParamSchema }),
  uploadPaymentReceipt.single("invoice"),
  asyncWrapper(inventoryController.uploadInventoryInvoice)
);

inventoryRoutes.delete(
  "/:id",
  validate({ params: inventoryIdParamSchema }),
  asyncWrapper(inventoryController.deleteInventoryItem)
);
