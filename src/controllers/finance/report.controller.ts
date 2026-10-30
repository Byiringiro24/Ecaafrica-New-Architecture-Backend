import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as reportService from "../../services/finance/report.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

const period = (req: Request) => ({
  from_date: req.query.from_date as string | undefined,
  to_date: req.query.to_date as string | undefined
});

export const getDashboardSummary = async (req: Request, res: Response) => {
  const data = await reportService.getFinanceSummary(resolveSchoolId(req), period(req));
  res.json(successResponse(data));
};

export const getDailyCollections = async (req: Request, res: Response) => {
  const data = await reportService.getDailyCollections(resolveSchoolId(req), period(req));
  res.json(successResponse(data));
};

export const getMonthlyCollections = async (req: Request, res: Response) => {
  const data = await reportService.getMonthlyCollections(resolveSchoolId(req), {
    ...period(req),
    months: req.query.months ? Number(req.query.months) : undefined
  });
  res.json(successResponse(data));
};

export const getPaymentMethods = async (req: Request, res: Response) => {
  const data = await reportService.getPaymentMethodBreakdown(
    resolveSchoolId(req),
    period(req)
  );
  res.json(successResponse(data));
};

export const getCollectionReport = async (req: Request, res: Response) => {
  const data = await reportService.getCollectionReport(resolveSchoolId(req), period(req));
  res.json(successResponse(data));
};

export const getDefaultersReport = async (req: Request, res: Response) => {
  const data = await reportService.getDefaulters(
    resolveSchoolId(req),
    req.query.limit ? Number(req.query.limit) : undefined
  );
  res.json(successResponse(data));
};

export const getExpensesByCategory = async (req: Request, res: Response) => {
  const data = await reportService.getExpensesByCategory(
    resolveSchoolId(req),
    period(req)
  );
  res.json(successResponse(data));
};

export const getPayrollSummary = async (req: Request, res: Response) => {
  const data = await reportService.getPayrollSummaryByDepartment(resolveSchoolId(req), {
    payroll_run_id: req.query.payroll_run_id as string | undefined
  });
  res.json(successResponse(data));
};

export const getInventoryValuation = async (req: Request, res: Response) => {
  const data = await reportService.getInventoryValuation(resolveSchoolId(req));
  res.json(successResponse(data));
};
