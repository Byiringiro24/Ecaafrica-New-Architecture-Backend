import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as levelService from "../services/level.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createLevel = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await levelService.createLevel(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listLevels = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await levelService.findAllLevels(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getLevel = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await levelService.findLevelById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateLevel = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await levelService.updateLevel(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteLevel = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await levelService.softDeleteLevel(schoolId, req.params.id);
  res.json(successResponse(record));
};
