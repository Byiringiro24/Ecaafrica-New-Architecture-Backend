import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as broadcastService from "../../services/notification/broadcast.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const sendParentBroadcast = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await broadcastService.sendParentBroadcast(schoolId, req.body);
  res.status(201).json(successResponse(result));
};

export const previewParentBroadcast = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await broadcastService.previewBroadcast(
    schoolId,
    req.body.audience
  );
  res.json(successResponse(result));
};
