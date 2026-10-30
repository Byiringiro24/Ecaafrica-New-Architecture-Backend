/**
 * @swagger
 * tags:
 *   - name: Finance Expenses
 *     description: School expense tracking and approval workflow
 *
 * /finance/expenses:
 *   get:
 *     summary: List expenses
 *     tags: [Finance Expenses]
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
 *         schema: { type: string, enum: [pending, approved, paid, rejected] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: from_date
 *         schema: { type: string }
 *       - in: query
 *         name: to_date
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *   post:
 *     summary: Record a new expense
 *     tags: [Finance Expenses]
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
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /finance/expenses/categories:
 *   get:
 *     summary: List supported expense categories
 *     tags: [Finance Expenses]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *
 * /finance/expenses/{id}:
 *   get:
 *     summary: Get expense by id
 *     tags: [Finance Expenses]
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
 *     summary: Update a pending expense
 *     tags: [Finance Expenses]
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
 *   delete:
 *     summary: Soft delete an expense
 *     tags: [Finance Expenses]
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
 * /finance/expenses/{id}/approve:
 *   patch:
 *     summary: Approve a pending expense
 *     tags: [Finance Expenses]
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
 * /finance/expenses/{id}/reject:
 *   patch:
 *     summary: Reject a pending expense
 *     tags: [Finance Expenses]
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
 * /finance/expenses/{id}/mark-paid:
 *   patch:
 *     summary: Mark an approved expense as paid
 *     tags: [Finance Expenses]
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
 * /finance/expenses/{id}/document:
 *   post:
 *     summary: Upload a supporting document for an expense
 *     tags: [Finance Expenses]
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
import * as expenseController from "../../controllers/finance/expense.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  createExpenseSchema,
  createExpenseCategorySchema,
  expenseIdParamSchema,
  listExpensesSchema,
  markExpensePaidSchema,
  rejectExpenseSchema,
  updateExpenseSchema
} from "../../validators/finance/expense.validator";

export const expenseRoutes = Router();

expenseRoutes.get(
  "/categories",
  asyncWrapper(expenseController.listExpenseCategories)
);

expenseRoutes.post(
  "/categories",
  validate(createExpenseCategorySchema),
  asyncWrapper(expenseController.createExpenseCategory)
);

expenseRoutes.get(
  "/",
  validate(listExpensesSchema),
  asyncWrapper(expenseController.listExpenses)
);

expenseRoutes.post(
  "/",
  validate(createExpenseSchema),
  asyncWrapper(expenseController.createExpense)
);

expenseRoutes.get(
  "/:id",
  validate({ params: expenseIdParamSchema }),
  asyncWrapper(expenseController.getExpense)
);

expenseRoutes.patch(
  "/:id",
  validate(updateExpenseSchema),
  asyncWrapper(expenseController.updateExpense)
);

expenseRoutes.patch(
  "/:id/approve",
  validate({ params: expenseIdParamSchema }),
  asyncWrapper(expenseController.approveExpense)
);

expenseRoutes.patch(
  "/:id/reject",
  validate(rejectExpenseSchema),
  asyncWrapper(expenseController.rejectExpense)
);

expenseRoutes.patch(
  "/:id/mark-paid",
  validate(markExpensePaidSchema),
  asyncWrapper(expenseController.markExpensePaid)
);

expenseRoutes.post(
  "/:id/document",
  validate({ params: expenseIdParamSchema }),
  uploadPaymentReceipt.single("document"),
  asyncWrapper(expenseController.uploadExpenseDocument)
);

expenseRoutes.delete(
  "/:id",
  validate({ params: expenseIdParamSchema }),
  asyncWrapper(expenseController.deleteExpense)
);
