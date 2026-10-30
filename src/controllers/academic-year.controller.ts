import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as academicYearService from "../services/academic-year.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createAcademicYear = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await academicYearService.createAcademicYear(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listAcademicYears = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await academicYearService.findAllAcademicYears(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getAcademicYear = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await academicYearService.findAcademicYearById(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};

export const updateAcademicYear = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await academicYearService.updateAcademicYear(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteAcademicYear = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await academicYearService.softDeleteAcademicYear(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};
