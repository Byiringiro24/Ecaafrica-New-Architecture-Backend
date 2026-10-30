import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as financeAuditService from "../../services/finance/audit.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const listFinanceAuditLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await financeAuditService.findFinanceAuditLogs(schoolId, pagination, {
    module: req.query.module as string | undefined,
    resource_type: req.query.resource_type as string | undefined,
    actor_id: req.query.actor_id as string | undefined,
    action: req.query.action as string | undefined,
    from_date: req.query.from_date as string | undefined,
    to_date: req.query.to_date as string | undefined
  });

  res.json(successResponse(result.data, result.meta));
};

export const listFinanceModules = async (_req: Request, res: Response) => {
  res.json(successResponse(financeAuditService.listFinanceModules()));
};
