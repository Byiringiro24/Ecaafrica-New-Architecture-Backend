import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as visitService from "../../services/visitor/visit.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createVisit = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const checkedInBy = req.user?.id;
  const record = await visitService.logEntry(schoolId, {
    ...req.body,
    checked_in_by: checkedInBy
  });
  res.status(201).json(successResponse(record));
};

export const listVisits = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    visitor_id: req.query.visitor_id as string | undefined,
    student_id: req.query.student_id as string | undefined,
    appointment_id: req.query.appointment_id as string | undefined,
    active_only: req.query.active_only === "true",
    from_date: req.query.from_date as string | undefined,
    to_date: req.query.to_date as string | undefined
  };
  const result = await visitService.findAllVisits(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getVisit = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await visitService.findVisitById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateVisit = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await visitService.updateVisit(schoolId, req.params.id, {
    ...req.body,
    checked_out_by: req.body.checked_out_at ? req.user?.id : undefined
  });
  res.json(successResponse(record));
};

export const deleteVisit = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await visitService.deleteVisit(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const checkOutVisit = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await visitService.logExit(schoolId, req.params.id, {
    checked_out_by: req.user?.id,
    notes: req.body?.notes
  });
  res.json(successResponse(record));
};
