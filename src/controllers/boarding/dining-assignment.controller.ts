import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import { hasEffectiveRole } from "../../middleware/roleGuard";
import * as service from "../../services/boarding/dining-assignment.service";

const school = (req: Request) => { if (!req.user?.school_id) throw new AppError("forbidden", "Missing school context", 403); return req.user.school_id; };
export const list = async (req: Request, res: Response) => {
  const canViewAll = hasEffectiveRole(req, "school_admin", "director_of_discipline", "patron", "matron");
  const teacherId = canViewAll
    ? req.query.teacher_id as string | undefined
    : hasEffectiveRole(req, "teacher")
      ? String(req.user!.id)
      : req.query.teacher_id as string | undefined;
  res.json(successResponse(await service.listAssignments(school(req), teacherId, req.query.date as string | undefined)));
};
export const create = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.createAssignment(school(req), req.user!.id, req.body)));
export const remove = async (req: Request, res: Response) => res.json(successResponse(await service.removeAssignment(school(req), req.params.id)));
