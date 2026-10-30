import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import * as invoiceService from "../../services/platform/invoice.service";

export const createInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.createInvoice(req.body);
  res.status(201).json(successResponse(invoice));
};

export const listInvoices = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    school_id: req.query.school_id as string | undefined,
    subscription_id: req.query.subscription_id as string | undefined
  };

  const result = await invoiceService.findAllInvoices(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.findInvoiceById(req.params.id);
  res.json(successResponse(invoice));
};

export const updateInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
  res.json(successResponse(invoice));
};

export const deleteInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.deleteInvoice(req.params.id);
  res.json(successResponse(invoice));
};

export const getRevenueSummary = async (_req: Request, res: Response) => {
  const summary = await invoiceService.getRevenueSummary();
  res.json(successResponse(summary));
};
