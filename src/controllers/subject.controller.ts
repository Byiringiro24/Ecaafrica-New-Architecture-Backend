import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as subjectService from "../services/subject.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await subjectService.createSubject(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listSubjects = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await subjectService.findAllSubjects(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await subjectService.findSubjectById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await subjectService.updateSubject(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await subjectService.softDeleteSubject(schoolId, req.params.id);
  res.json(successResponse(record));
};
