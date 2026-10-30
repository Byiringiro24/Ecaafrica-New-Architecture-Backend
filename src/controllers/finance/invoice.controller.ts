import type { StudentInvoiceStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as invoiceService from "../../services/finance/invoice.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const listInvoices = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await invoiceService.findAllInvoices(schoolId, pagination, {
    status: req.query.status as StudentInvoiceStatus | undefined,
    student_id: req.query.student_id as string | undefined,
    term_id: req.query.term_id as string | undefined,
    academic_year_id: req.query.academic_year_id as string | undefined,
    from_date: req.query.from_date as string | undefined,
    to_date: req.query.to_date as string | undefined
  });

  res.json(successResponse(result.data, result.meta));
};

export const createInvoice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await invoiceService.createInvoice(schoolId, req.user?.id, req.body);
  res.status(201).json(successResponse(record));
};

export const getInvoice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await invoiceService.findInvoiceById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateInvoice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await invoiceService.updateInvoice(schoolId, req.params.id, req.user?.id, req.body);
  res.json(successResponse(record));
};

export const issueInvoice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await invoiceService.issueInvoice(schoolId, req.params.id, req.user?.id);
  res.json(successResponse(record));
};

export const recordInvoicePayment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await invoiceService.recordInvoicePayment(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body
  );
  res.json(successResponse(record));
};

export const cancelInvoice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await invoiceService.cancelInvoice(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body?.reason
  );
  res.json(successResponse(record));
};

export const refundInvoice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await invoiceService.refundInvoice(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body?.reason
  );
  res.json(successResponse(record));
};

export const deleteInvoice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await invoiceService.deleteInvoice(schoolId, req.params.id, req.user?.id);
  res.json(successResponse(record));
};

export const uploadInvoiceDocument = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);

  if (!req.file) {
    throw new AppError("bad_request", "Document file is required", 400);
  }

  const record = await invoiceService.attachInvoiceDocument(
    schoolId,
    req.params.id,
    `uploads/${req.file.filename}`
  );
  res.json(successResponse(record));
};
