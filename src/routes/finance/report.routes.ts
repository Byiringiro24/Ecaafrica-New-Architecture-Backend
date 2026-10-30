/**
 * @swagger
 * tags:
 *   - name: Finance Reports
 *     description: Financial reports backing the Reports page
 *
 * /finance/reports/collections:
 *   get:
 *     summary: Collection report (monthly trend + payment method split)
 *     tags: [Finance Reports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema: { type: string }
 *       - in: query
 *         name: to_date
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *
 * /finance/reports/defaulters:
 *   get:
 *     summary: Students with unpaid or overdue balances
 *     tags: [Finance Reports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *
 * /finance/reports/expenses-by-category:
 *   get:
 *     summary: Expense totals grouped by category
 *     tags: [Finance Reports]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *
 * /finance/reports/payroll-summary:
 *   get:
 *     summary: Payroll totals grouped by department
 *     tags: [Finance Reports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: payroll_run_id
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *
 * /finance/reports/inventory-valuation:
 *   get:
 *     summary: Inventory stock valuation
 *     tags: [Finance Reports]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 */
import { Router } from "express";
import * as reportController from "../../controllers/finance/report.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  collectionReportSchema,
  defaultersSchema,
  expensesByCategorySchema,
  payrollSummarySchema
} from "../../validators/finance/report.validator";

export const reportRoutes = Router();

reportRoutes.get(
  "/collections",
  validate(collectionReportSchema),
  asyncWrapper(reportController.getCollectionReport)
);

reportRoutes.get(
  "/defaulters",
  validate(defaultersSchema),
  asyncWrapper(reportController.getDefaultersReport)
);

reportRoutes.get(
  "/expenses-by-category",
  validate(expensesByCategorySchema),
  asyncWrapper(reportController.getExpensesByCategory)
);

reportRoutes.get(
  "/payroll-summary",
  validate(payrollSummarySchema),
  asyncWrapper(reportController.getPayrollSummary)
);

reportRoutes.get(
  "/inventory-valuation",
  asyncWrapper(reportController.getInventoryValuation)
);
