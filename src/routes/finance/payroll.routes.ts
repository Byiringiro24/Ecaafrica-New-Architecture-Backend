/**
 * @swagger
 * tags:
 *   - name: Finance Payroll
 *     description: Payroll runs and payslips
 *
 * /finance/payroll/runs:
 *   get:
 *     summary: List payroll runs
 *     tags: [Finance Payroll]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, submitted, approved, paid] }
 *       - in: query
 *         name: year
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *   post:
 *     summary: Generate a payroll run for a month
 *     description: Seeds a draft payslip for every active staff member with a basic salary on file.
 *     tags: [Finance Payroll]
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
 *       409: { $ref: "#/components/responses/Conflict" }
 *
 * /finance/payroll/runs/{id}:
 *   get:
 *     summary: Get a payroll run
 *     tags: [Finance Payroll]
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
 *     summary: Delete a draft or submitted payroll run
 *     tags: [Finance Payroll]
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
 * /finance/payroll/runs/{id}/submit:
 *   patch:
 *     summary: Submit a draft payroll run for approval
 *     tags: [Finance Payroll]
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
 * /finance/payroll/runs/{id}/approve:
 *   patch:
 *     summary: Approve a submitted payroll run
 *     tags: [Finance Payroll]
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
 * /finance/payroll/runs/{id}/mark-paid:
 *   patch:
 *     summary: Mark an approved payroll run as paid
 *     tags: [Finance Payroll]
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
 * /finance/payroll/runs/{id}/payslips:
 *   post:
 *     summary: Add a payslip to a draft payroll run
 *     description: Gross, PAYE tax, RSSB pension and net are computed server-side from the raw inputs.
 *     tags: [Finance Payroll]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { $ref: "#/components/responses/Success" }
 *       409: { $ref: "#/components/responses/Conflict" }
 *
 * /finance/payroll/payslips:
 *   get:
 *     summary: List payslips
 *     tags: [Finance Payroll]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: payroll_run_id
 *         schema: { type: string }
 *       - in: query
 *         name: staff_id
 *         schema: { type: string }
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *
 * /finance/payroll/payslips/{id}:
 *   get:
 *     summary: Get a payslip with its full earnings and deductions breakdown
 *     tags: [Finance Payroll]
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
 *     summary: Update a draft payslip and recompute its totals
 *     tags: [Finance Payroll]
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
 *     summary: Remove a payslip from a draft payroll run
 *     tags: [Finance Payroll]
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
 * /finance/payroll/payslips/{id}/mark-paid:
 *   patch:
 *     summary: Mark an approved payslip as paid
 *     tags: [Finance Payroll]
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
import * as payrollController from "../../controllers/finance/payroll.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  createPayslipSchema,
  generatePayrollRunSchema,
  listPayrollRunsSchema,
  listPayslipsSchema,
  markPayrollRunPaidSchema,
  markPayslipPaidSchema,
  payrollRunIdParamSchema,
  payslipIdParamSchema,
  updatePayslipSchema
} from "../../validators/finance/payroll.validator";

export const payrollRoutes = Router();

payrollRoutes.get(
  "/payslips",
  validate(listPayslipsSchema),
  asyncWrapper(payrollController.listPayslips)
);

payrollRoutes.get(
  "/payslips/:id",
  validate({ params: payslipIdParamSchema }),
  asyncWrapper(payrollController.getPayslip)
);

payrollRoutes.patch(
  "/payslips/:id",
  validate(updatePayslipSchema),
  asyncWrapper(payrollController.updatePayslip)
);

payrollRoutes.patch(
  "/payslips/:id/mark-paid",
  validate(markPayslipPaidSchema),
  asyncWrapper(payrollController.markPayslipPaid)
);

payrollRoutes.delete(
  "/payslips/:id",
  validate({ params: payslipIdParamSchema }),
  asyncWrapper(payrollController.deletePayslip)
);

payrollRoutes.get(
  "/runs",
  validate(listPayrollRunsSchema),
  asyncWrapper(payrollController.listPayrollRuns)
);

payrollRoutes.post(
  "/runs",
  validate(generatePayrollRunSchema),
  asyncWrapper(payrollController.generatePayrollRun)
);

payrollRoutes.get(
  "/runs/:id",
  validate({ params: payrollRunIdParamSchema }),
  asyncWrapper(payrollController.getPayrollRun)
);

payrollRoutes.post(
  "/runs/:id/payslips",
  validate(createPayslipSchema),
  asyncWrapper(payrollController.createPayslip)
);

payrollRoutes.patch(
  "/runs/:id/submit",
  validate({ params: payrollRunIdParamSchema }),
  asyncWrapper(payrollController.submitPayrollRun)
);

payrollRoutes.patch(
  "/runs/:id/approve",
  validate({ params: payrollRunIdParamSchema }),
  asyncWrapper(payrollController.approvePayrollRun)
);

payrollRoutes.patch(
  "/runs/:id/mark-paid",
  validate(markPayrollRunPaidSchema),
  asyncWrapper(payrollController.markPayrollRunPaid)
);

payrollRoutes.delete(
  "/runs/:id",
  validate({ params: payrollRunIdParamSchema }),
  asyncWrapper(payrollController.deletePayrollRun)
);
