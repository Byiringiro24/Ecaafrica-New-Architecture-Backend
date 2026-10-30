import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import * as smsUsageService from "../../services/platform/sms-usage.service";

export const getSmsUsage = async (req: Request, res: Response) => {
  const result = await smsUsageService.getSmsUsage({
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    schoolId: req.query.school_id as string | undefined
  });
  res.json(successResponse(result));
};
