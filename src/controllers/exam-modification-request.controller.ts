import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as service from "../services/exam-modification-request.service";
import { hasEffectiveRole } from "../middleware/roleGuard";

const schoolId = (req: Request) => {
  if (!req.user?.school_id) throw new AppError("forbidden", "Missing school context", 403);
  return String(req.user.school_id);
};

export const create = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.createRequest(schoolId(req), req.params.examId, String(req.user?.id), req.body.reason)));
export const list = async (req: Request, res: Response) => res.json(successResponse(await service.listRequests(
  schoolId(req),
  req.query.status as string | undefined,
  hasEffectiveRole(req, "teacher") && !hasEffectiveRole(req, "school_admin", "director_of_studies")
    ? String(req.user!.id)
    : undefined
)));
export const review = async (req: Request, res: Response) => res.json(successResponse(await service.reviewRequest(schoolId(req), req.params.id, String(req.user?.id), req.body.status)));
