import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as sessionService from "../../services/attendance/session.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const session = await sessionService.createSession(schoolId, {
    ...req.body,
    teacher_id: req.body.teacher_id ?? req.user?.id
  });
  res.status(201).json(successResponse(session));
};

export const listSessions = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    section_id: req.query.section_id as string | undefined,
    class_id: req.query.class_id as string | undefined,
    session_type: req.query.session_type as
      | import("@prisma/client").AttendanceSessionType
      | undefined,
    period_id: req.query.period_id as string | undefined,
    subject_id: req.query.subject_id as string | undefined,
    teacher_id: req.query.teacher_id as string | undefined,
    date: req.query.date as string | undefined
  };

  const result = await sessionService.listSessionsBySchoolAndDate(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const session = await sessionService.findSessionById(schoolId, req.params.id);
  res.json(successResponse(session));
};

export const updateSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const session = await sessionService.updateSession(schoolId, req.params.id, req.body);
  res.json(successResponse(session));
};

export const closeSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const session = await sessionService.closeSession(schoolId, req.params.id);
  res.json(successResponse(session));
};

export const deleteSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const session = await sessionService.deleteSession(schoolId, req.params.id);
  res.json(successResponse(session));
};
