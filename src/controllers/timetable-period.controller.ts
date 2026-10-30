import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as timetablePeriodService from "../services/timetable-period.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createTimetablePeriod = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await timetablePeriodService.createTimetablePeriod(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listTimetablePeriods = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await timetablePeriodService.findAllTimetablePeriods(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getTimetablePeriod = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await timetablePeriodService.findTimetablePeriodById(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};

export const updateTimetablePeriod = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await timetablePeriodService.updateTimetablePeriod(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteTimetablePeriod = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await timetablePeriodService.softDeleteTimetablePeriod(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};
