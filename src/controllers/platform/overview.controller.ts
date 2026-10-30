import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import * as overviewService from "../../services/platform/overview.service";

export const getPlatformOverview = async (_req: Request, res: Response) => {
  const overview = await overviewService.getPlatformOverview();
  res.json(successResponse(overview));
};
