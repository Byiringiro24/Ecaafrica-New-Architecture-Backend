import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as teacherSectionSubjectService from "../services/teacher-section-subject.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createTeacherSectionSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await teacherSectionSubjectService.createTeacherSectionSubject(
    schoolId,
    req.body
  );
  res.status(201).json(successResponse(record));
};

export const listTeacherSectionSubjects = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    teacher_id: req.query.teacher_id as string | undefined,
    section_id: req.query.section_id as string | undefined,
    subject_id: req.query.subject_id as string | undefined,
    term_id: req.query.term_id as string | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await teacherSectionSubjectService.findAllTeacherSectionSubjects(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getTeacherSectionSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await teacherSectionSubjectService.findTeacherSectionSubjectById(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};

export const updateTeacherSectionSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await teacherSectionSubjectService.updateTeacherSectionSubject(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteTeacherSectionSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await teacherSectionSubjectService.softDeleteTeacherSectionSubject(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};
