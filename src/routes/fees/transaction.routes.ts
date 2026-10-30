/**
 * @swagger
 * tags:
 *   - name: Fee Transactions
 *     description: Fee transaction management
 *
 * /fees/transactions:
 *   get:
 *     summary: List fee transactions
 *     tags: [Fee Transactions]
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
 *     summary: Create fee transaction
 *     tags: [Fee Transactions]
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
 * /fees/transactions/{id}:
 *   get:
 *     summary: Get fee transaction by id
 *     tags: [Fee Transactions]
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
 *     summary: Update fee transaction
 *     tags: [Fee Transactions]
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
 *     summary: Delete fee transaction
 *     tags: [Fee Transactions]
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
 * /fees/transactions/{id}/receipt:
 *   post:
 *     summary: Upload payment receipt
 *     tags: [Fee Transactions]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
import { Router } from "express";
import * as transactionController from "../../controllers/fees/transaction.controller";
import { uploadPaymentReceipt } from "../../configs/multer";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  createFeeTransactionSchema,
  feeTransactionIdParamSchema,
  listFeeTransactionsSchema,
  updateFeeTransactionSchema
} from "../../validators/fees/transaction.validator";

export const feeTransactionRoutes = Router();

feeTransactionRoutes.get(
  "/",
  validate(listFeeTransactionsSchema),
  asyncWrapper(transactionController.listTransactions)
);

feeTransactionRoutes.post(
  "/",
  validate(createFeeTransactionSchema),
  asyncWrapper(transactionController.createTransaction)
);

feeTransactionRoutes.get(
  "/:id",
  validate({ params: feeTransactionIdParamSchema }),
  asyncWrapper(transactionController.getTransaction)
);

feeTransactionRoutes.patch(
  "/:id",
  validate(updateFeeTransactionSchema),
  asyncWrapper(transactionController.updateTransaction)
);

feeTransactionRoutes.delete(
  "/:id",
  validate({ params: feeTransactionIdParamSchema }),
  asyncWrapper(transactionController.deleteTransaction)
);

feeTransactionRoutes.post(
  "/:id/receipt",
  uploadPaymentReceipt.single("receipt"),
  validate({ params: feeTransactionIdParamSchema }),
  asyncWrapper(transactionController.uploadReceipt)
);
