import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import { bulkSmsSend, type BulkSmsFilter } from "../../services/notification/bulk-sms.service";

const resolveSchoolId = (req: Request) => {
  const id = req.user?.school_id;
  if (!id) throw new AppError("forbidden", "Missing school context", 403);
  return id;
};

/**
 * POST /notifications/bulk-sms
 * Body:
 *   filter: { type: "all" }
 *         | { type: "class",     class_id: string }
 *         | { type: "dormitory", dormitory_id: string }
 *         | { type: "parent",    parent_id: string }
 *   message: string
 *   preview?: boolean   — if true, returns parent_count only, sends nothing
 */
export const sendBulkSms = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const { filter, message, preview } = req.body as {
    filter: BulkSmsFilter;
    message: string;
    preview?: boolean;
  };

  if (!filter?.type) throw new AppError("bad_request", "filter.type is required", 400);
  if (!preview && !message?.trim()) throw new AppError("bad_request", "message is required", 400);

  const result = await bulkSmsSend(schoolId, { filter, message, preview: Boolean(preview) });
  res.status(202).json(successResponse(result));
};
