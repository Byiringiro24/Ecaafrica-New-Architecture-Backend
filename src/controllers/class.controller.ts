import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as classService from "../services/class.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createClass = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await classService.createClass(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listClasses = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    academic_year_id: req.query.academic_year_id as string | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await classService.findAllClasses(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getClass = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await classService.findClassById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateClass = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await classService.updateClass(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteClass = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await classService.softDeleteClass(schoolId, req.params.id);
  res.json(successResponse(record));
};
