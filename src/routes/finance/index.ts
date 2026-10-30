/**
 * @swagger
 * tags:
 *   - name: Finance Audit
 *     description: Finance activity trail across all finance modules
 *
 * /finance/audit-logs:
 *   get:
 *     summary: List finance audit entries
 *     description: Audit trail filtered to finance resource types (fees, invoices, payments, expenses, inventory, payroll).
 *     tags: [Finance Audit]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: module
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string }
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
 * /finance/audit-logs/modules:
 *   get:
 *     summary: List the finance modules covered by the audit trail
 *     tags: [Finance Audit]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 */
import { Router } from "express";
import * as financeAuditController from "../../controllers/finance/audit.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireRole, requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { listFinanceAuditSchema } from "../../validators/finance/audit.validator";
import { dashboardRoutes } from "./dashboard.routes";
import { expenseRoutes } from "./expense.routes";
import { inventoryRoutes } from "./inventory.routes";
import { invoiceRoutes } from "./invoice.routes";
import { payrollRoutes } from "./payroll.routes";
import { reportRoutes } from "./report.routes";
import { supplierRoutes } from "./supplier.routes";

export const financeRoutes = Router();

financeRoutes.use(verifyToken, requireSchoolAccess, requireRole("finance_officer"));

financeRoutes.get(
  "/audit-logs/modules",
  asyncWrapper(financeAuditController.listFinanceModules)
);

financeRoutes.get(
  "/audit-logs",
  validate(listFinanceAuditSchema),
  asyncWrapper(financeAuditController.listFinanceAuditLogs)
);

financeRoutes.use("/dashboard", dashboardRoutes);
financeRoutes.use("/reports", reportRoutes);
financeRoutes.use("/invoices", invoiceRoutes);
financeRoutes.use("/expenses", expenseRoutes);
financeRoutes.use("/suppliers", supplierRoutes);
financeRoutes.use("/inventory", inventoryRoutes);
financeRoutes.use("/payroll", payrollRoutes);
