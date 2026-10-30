import type { ExpenseStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as expenseService from "../../services/finance/expense.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const listExpenses = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await expenseService.findAllExpenses(schoolId, pagination, {
    status: req.query.status as ExpenseStatus | undefined,
    category: req.query.category as string | undefined,
    vendor: req.query.vendor as string | undefined,
    from_date: req.query.from_date as string | undefined,
    to_date: req.query.to_date as string | undefined
  });

  res.json(successResponse(result.data, result.meta));
};

export const listExpenseCategories = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  res.json(successResponse(await expenseService.findExpenseCategories(schoolId)));
};

export const createExpenseCategory = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const category = await expenseService.createExpenseCategory(schoolId, req.body.name);
  res.status(201).json(successResponse(category));
};

export const createExpense = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await expenseService.createExpense(schoolId, req.user?.id, req.body);
  res.status(201).json(successResponse(record));
};

export const getExpense = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await expenseService.findExpenseById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateExpense = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await expenseService.updateExpense(schoolId, req.params.id, req.user?.id, req.body);
  res.json(successResponse(record));
};

export const approveExpense = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await expenseService.approveExpense(schoolId, req.params.id, req.user?.id);
  res.json(successResponse(record));
};

export const rejectExpense = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await expenseService.rejectExpense(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body.reason
  );
  res.json(successResponse(record));
};

export const markExpensePaid = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await expenseService.markExpensePaid(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body ?? {}
  );
  res.json(successResponse(record));
};

export const deleteExpense = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await expenseService.deleteExpense(schoolId, req.params.id, req.user?.id);
  res.json(successResponse(record));
};

export const uploadExpenseDocument = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);

  if (!req.file) {
    throw new AppError("bad_request", "Document file is required", 400);
  }

  const record = await expenseService.attachExpenseDocument(
    schoolId,
    req.params.id,
    `uploads/${req.file.filename}`
  );
  res.json(successResponse(record));
};
