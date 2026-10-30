import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as auditService from "../services/audit.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const listAuditLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);

  const filters = {
    school_id: schoolId,
    actor_id: req.query.actor_id as string | undefined,
    actor_type: req.query.actor_type as string | undefined,
    action: req.query.action as string | undefined,
    resource_type: req.query.resource_type as string | undefined,
    severity: req.query.severity as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined
  };

  const result = await auditService.findAuditLogs(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};
