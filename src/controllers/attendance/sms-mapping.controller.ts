import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as mappingService from "../../services/attendance/sms-mapping.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) throw new AppError("forbidden", "Missing school context", 403);
  return schoolId;
};

export const listMappings = async (req: Request, res: Response) => {
  res.json(successResponse(await mappingService.listMappings(resolveSchoolId(req))));
};

export const upsertMapping = async (req: Request, res: Response) => {
  res.json(
    successResponse(await mappingService.upsertMapping(resolveSchoolId(req), req.body))
  );
};
