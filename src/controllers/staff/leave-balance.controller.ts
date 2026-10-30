import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as leaveBalanceService from "../../services/staff/leave-balance.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createLeaveBalance = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveBalanceService.createLeaveBalance(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listLeaveBalances = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    staff_id: req.query.staff_id as string | undefined,
    academic_year_id: req.query.academic_year_id as string | undefined
  };
  const result = await leaveBalanceService.findAllLeaveBalances(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getLeaveBalance = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveBalanceService.findLeaveBalanceById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateLeaveBalance = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveBalanceService.updateLeaveBalance(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteLeaveBalance = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveBalanceService.deleteLeaveBalance(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const deductLeaveBalance = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveBalanceService.deductLeaveBalanceOnApproval(
    schoolId,
    req.params.id,
    req.body.leave_type,
    req.body.days
  );
  res.json(successResponse(record));
};
