import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as supervisorService from "../../services/boarding/supervisor.service";
import { hasEffectiveRole } from "../../middleware/roleGuard";

const schoolId = (req: Request) => {
  if (!req.user?.school_id)
    throw new AppError("forbidden", "Missing school context", 403);
  return req.user.school_id;
};

export const createBoardingSupervisor = async (req: Request, res: Response) => {
  const record = await supervisorService.createBoardingSupervisor(
    schoolId(req),
    req.body,
  );
  res.status(201).json(successResponse(record));
};

export const listBoardingSupervisors = async (req: Request, res: Response) => {
  const ownOnly = hasEffectiveRole(req, "patron", "matron");
  const records = await supervisorService.listBoardingSupervisors(
    schoolId(req),
    req.user?.id,
    ownOnly,
  );
  res.json(successResponse(records));
};

export const replaceSupervisorDormitories = async (
  req: Request,
  res: Response,
) => {
  const record = await supervisorService.replaceSupervisorDormitories(
    schoolId(req),
    req.params.id,
    req.body.dormitory_ids,
  );
  res.json(successResponse(record));
};
