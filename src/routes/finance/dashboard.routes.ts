/**
 * @swagger
 * tags:
 *   - name: Finance Dashboard
 *     description: Finance KPI dashboard and charts
 *
 * /finance/dashboard/summary:
 *   get:
 *     summary: Finance KPI summary
 *     description: Expected, collected, outstanding, overdue, payroll, expenses, inventory and net cash position.
 *     tags: [Finance Dashboard]
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
 * /finance/dashboard/collections/daily:
 *   get:
 *     summary: Daily collection totals (defaults to the last 30 days)
 *     tags: [Finance Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *
 * /finance/dashboard/collections/monthly:
 *   get:
 *     summary: Collected vs expected per month
 *     tags: [Finance Dashboard]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *
 * /finance/dashboard/payment-methods:
 *   get:
 *     summary: Collections grouped by payment method
 *     tags: [Finance Dashboard]
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
  dailyCollectionsSchema,
  dashboardSummarySchema,
  monthlyCollectionsSchema,
  paymentMethodsSchema
} from "../../validators/finance/report.validator";

export const dashboardRoutes = Router();

dashboardRoutes.get(
  "/summary",
  validate(dashboardSummarySchema),
  asyncWrapper(reportController.getDashboardSummary)
);

dashboardRoutes.get(
  "/collections/daily",
  validate(dailyCollectionsSchema),
  asyncWrapper(reportController.getDailyCollections)
);

dashboardRoutes.get(
  "/collections/monthly",
  validate(monthlyCollectionsSchema),
  asyncWrapper(reportController.getMonthlyCollections)
);

dashboardRoutes.get(
  "/payment-methods",
  validate(paymentMethodsSchema),
  asyncWrapper(reportController.getPaymentMethods)
);
