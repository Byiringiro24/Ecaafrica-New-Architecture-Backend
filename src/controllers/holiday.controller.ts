import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as holidayService from "../services/holiday.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createHoliday = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await holidayService.createHoliday(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listHolidays = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await holidayService.findAllHolidays(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getHoliday = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await holidayService.findHolidayById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateHoliday = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await holidayService.updateHoliday(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteHoliday = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await holidayService.softDeleteHoliday(schoolId, req.params.id);
  res.json(successResponse(record));
};
