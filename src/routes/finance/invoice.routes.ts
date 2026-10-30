/**
 * @swagger
 * tags:
 *   - name: Finance Invoices
 *     description: Student invoice generation and lifecycle
 *
 * /finance/invoices:
 *   get:
 *     summary: List student invoices
 *     tags: [Finance Invoices]
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
 *         schema: { type: string, enum: [draft, pending, partially_paid, paid, cancelled, refunded] }
 *       - in: query
 *         name: student_id
 *         schema: { type: string }
 *       - in: query
 *         name: term_id
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *   post:
 *     summary: Generate a student invoice
 *     tags: [Finance Invoices]
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
 *       404: { $ref: "#/components/responses/NotFound" }
 *
 * /finance/invoices/{id}:
 *   get:
 *     summary: Get an invoice with its line items
 *     tags: [Finance Invoices]
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
 *     summary: Update an invoice and recompute its totals
 *     tags: [Finance Invoices]
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
 *     summary: Soft delete an unpaid invoice
 *     tags: [Finance Invoices]
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
 * /finance/invoices/{id}/issue:
 *   patch:
 *     summary: Issue a draft invoice
 *     tags: [Finance Invoices]
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
 * /finance/invoices/{id}/payments:
 *   post:
 *     summary: Apply a payment to an invoice and recompute its status
 *     tags: [Finance Invoices]
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
 *       409: { $ref: "#/components/responses/Conflict" }
 *
 * /finance/invoices/{id}/cancel:
 *   patch:
 *     summary: Cancel an unpaid invoice
 *     tags: [Finance Invoices]
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
 * /finance/invoices/{id}/refund:
 *   patch:
 *     summary: Refund a paid invoice
 *     tags: [Finance Invoices]
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
 * /finance/invoices/{id}/document:
 *   post:
 *     summary: Attach a document to an invoice
 *     tags: [Finance Invoices]
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
import * as invoiceController from "../../controllers/finance/invoice.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  createInvoiceSchema,
  invoiceIdParamSchema,
  invoiceReasonSchema,
  listInvoicesSchema,
  recordInvoicePaymentSchema,
  updateInvoiceSchema
} from "../../validators/finance/invoice.validator";

export const invoiceRoutes = Router();

invoiceRoutes.get(
  "/",
  validate(listInvoicesSchema),
  asyncWrapper(invoiceController.listInvoices)
);

invoiceRoutes.post(
  "/",
  validate(createInvoiceSchema),
  asyncWrapper(invoiceController.createInvoice)
);

invoiceRoutes.get(
  "/:id",
  validate({ params: invoiceIdParamSchema }),
  asyncWrapper(invoiceController.getInvoice)
);

invoiceRoutes.patch(
  "/:id",
  validate(updateInvoiceSchema),
  asyncWrapper(invoiceController.updateInvoice)
);

invoiceRoutes.patch(
  "/:id/issue",
  validate({ params: invoiceIdParamSchema }),
  asyncWrapper(invoiceController.issueInvoice)
);

invoiceRoutes.post(
  "/:id/payments",
  validate(recordInvoicePaymentSchema),
  asyncWrapper(invoiceController.recordInvoicePayment)
);

invoiceRoutes.patch(
  "/:id/cancel",
  validate(invoiceReasonSchema),
  asyncWrapper(invoiceController.cancelInvoice)
);

invoiceRoutes.patch(
  "/:id/refund",
  validate(invoiceReasonSchema),
  asyncWrapper(invoiceController.refundInvoice)
);

invoiceRoutes.post(
  "/:id/document",
  validate({ params: invoiceIdParamSchema }),
  uploadPaymentReceipt.single("document"),
  asyncWrapper(invoiceController.uploadInvoiceDocument)
);

invoiceRoutes.delete(
  "/:id",
  validate({ params: invoiceIdParamSchema }),
  asyncWrapper(invoiceController.deleteInvoice)
);
