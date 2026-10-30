import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as transactionService from "../../services/fees/transaction.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createTransaction = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const receivedBy = req.user?.id;
  const record = await transactionService.recordPayment(schoolId, {
    ...req.body,
    received_by: receivedBy
  });
  res.status(201).json(successResponse(record));
};

export const listTransactions = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    student_id: req.query.student_id as string | undefined,
    fee_assignment_id: req.query.fee_assignment_id as string | undefined,
    from_date: req.query.from_date as string | undefined,
    to_date: req.query.to_date as string | undefined
  };

  const result = await transactionService.findAllTransactions(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getTransaction = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await transactionService.findTransactionById(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};

export const updateTransaction = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await transactionService.updateTransaction(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteTransaction = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await transactionService.deleteTransaction(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const getFeeSummary = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const summary = await transactionService.getSchoolFeeSummary(schoolId, {
    term_id: req.query.term_id as string | undefined,
    academic_year_id: req.query.academic_year_id as string | undefined
  });
  res.json(successResponse(summary));
};

export const getStudentBalance = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const balance = await transactionService.getStudentBalance(
    schoolId,
    req.params.id
  );
  res.json(successResponse(balance));
};

export const uploadReceipt = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);

  if (!req.file) {
    throw new AppError("bad_request", "Receipt file is required", 400);
  }

  const receiptUrl = `uploads/${req.file.filename}`;
  const record = await transactionService.attachReceiptToTransaction(
    schoolId,
    req.params.id,
    receiptUrl
  );
  res.json(successResponse(record));
};
