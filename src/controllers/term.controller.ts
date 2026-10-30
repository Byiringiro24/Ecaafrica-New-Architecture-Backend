import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as termService from "../services/term.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createTerm = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await termService.createTerm(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listTerms = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    academic_year_id: req.query.academic_year_id as string | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await termService.findAllTerms(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getTerm = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await termService.findTermById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateTerm = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await termService.updateTerm(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteTerm = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await termService.softDeleteTerm(schoolId, req.params.id);
  res.json(successResponse(record));
};
