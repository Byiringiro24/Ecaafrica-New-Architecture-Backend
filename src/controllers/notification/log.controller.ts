import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as senderService from "../../services/notification/sender.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const listNotificationLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    channel: req.query.channel as string | undefined,
    recipient_type: req.query.recipient_type as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined
  };

  const result = await senderService.findNotificationLogs(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};
