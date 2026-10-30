import type { PayrollRunStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as payrollService from "../../services/finance/payroll.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const listPayrollRuns = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await payrollService.findAllPayrollRuns(schoolId, pagination, {
    status: req.query.status as PayrollRunStatus | undefined,
    year: req.query.year ? Number(req.query.year) : undefined
  });

  res.json(successResponse(result.data, result.meta));
};

export const generatePayrollRun = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.generatePayrollRun(schoolId, req.user?.id, req.body);
  res.status(201).json(successResponse(record));
};

export const getPayrollRun = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.findPayrollRunById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const submitPayrollRun = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.submitPayrollRun(
    schoolId,
    req.params.id,
    req.user?.id
  );
  res.json(successResponse(record));
};

export const approvePayrollRun = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.approvePayrollRun(
    schoolId,
    req.params.id,
    req.user?.id
  );
  res.json(successResponse(record));
};

export const markPayrollRunPaid = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.markPayrollRunPaid(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body?.paid_at
  );
  res.json(successResponse(record));
};

export const deletePayrollRun = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.deletePayrollRun(schoolId, req.params.id, req.user?.id);
  res.json(successResponse(record));
};

export const listPayslips = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await payrollService.findAllPayslips(schoolId, pagination, {
    payroll_run_id: req.query.payroll_run_id as string | undefined,
    staff_id: req.query.staff_id as string | undefined,
    status: req.query.status as PayrollRunStatus | undefined,
    department: req.query.department as string | undefined
  });

  res.json(successResponse(result.data, result.meta));
};

export const createPayslip = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.createPayslip(schoolId, req.params.id, req.user?.id, req.body);
  res.status(201).json(successResponse(record));
};

export const getPayslip = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.findPayslipById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updatePayslip = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.updatePayslip(schoolId, req.params.id, req.user?.id, req.body);
  res.json(successResponse(record));
};

export const markPayslipPaid = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.markPayslipPaid(
    schoolId,
    req.params.id,
    req.user?.id,
    req.body ?? {}
  );
  res.json(successResponse(record));
};

export const deletePayslip = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await payrollService.deletePayslip(schoolId, req.params.id, req.user?.id);
  res.json(successResponse(record));
};
