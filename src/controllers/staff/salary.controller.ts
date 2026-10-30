import type { SalaryStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as salaryService from "../../services/staff/salary.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createSalaryRecord = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await salaryService.createSalaryRecord(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listSalaryRecords = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    staff_id: req.query.staff_id as string | undefined,
    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,
    status: req.query.status as SalaryStatus | undefined
  };
  const result = await salaryService.findAllSalaryRecords(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getSalaryRecord = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await salaryService.findSalaryRecordById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateSalaryRecord = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await salaryService.updateSalaryRecord(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteSalaryRecord = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await salaryService.deleteSalaryRecord(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const markSalaryPaid = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await salaryService.markSalaryAsPaid(schoolId, req.params.id, req.body ?? {});
  res.json(successResponse(record));
};
