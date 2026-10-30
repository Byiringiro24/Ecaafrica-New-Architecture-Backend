/**
 * @swagger
 * tags:
 *   - name: Fees
 *     description: Fee summaries and balances
 *
 * /fees/summary:
 *   get:
 *     summary: Get fee summary
 *     tags: [Fees]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /fees/students/{id}/balance:
 *   get:
 *     summary: Get student fee balance
 *     tags: [Fees]
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
import * as transactionController from "../../controllers/fees/transaction.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireRole, requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  feeSummaryQuerySchemaExport,
  studentIdParamSchema
} from "../../validators/fees/transaction.validator";
import { feeAssignmentRoutes } from "./assignment.routes";
import { feeStructureRoutes } from "./structure.routes";
import { feeTransactionRoutes } from "./transaction.routes";

export const feesRoutes = Router();

feesRoutes.use(
  verifyToken,
  requireSchoolAccess,
  requireRole("finance_officer", "school_admin")
);

feesRoutes.get(
  "/summary",
  validate(feeSummaryQuerySchemaExport),
  asyncWrapper(transactionController.getFeeSummary)
);

feesRoutes.get(
  "/students/:id/balance",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(transactionController.getStudentBalance)
);

feesRoutes.use("/structures", feeStructureRoutes);
feesRoutes.use("/assignments", feeAssignmentRoutes);
feesRoutes.use("/transactions", feeTransactionRoutes);
