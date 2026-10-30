import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as systemSettingsService from "../services/system-settings.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const listSettings = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await systemSettingsService.findAllSettings(pagination, schoolId);
  res.json(successResponse(result.data, result.meta));
};

export const getSetting = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await systemSettingsService.findSettingById(req.params.id, schoolId);
  res.json(successResponse(record));
};

export const getSettingByKey = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await systemSettingsService.getSettingByKey(req.params.key, schoolId);
  res.json(successResponse(record));
};

export const createSetting = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await systemSettingsService.createSetting(
    req.body,
    schoolId,
    req.user?.id
  );
  res.status(201).json(successResponse(record));
};

export const updateSetting = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await systemSettingsService.updateSettingById(
    req.params.id,
    req.body,
    schoolId,
    req.user?.id
  );
  res.json(successResponse(record));
};

export const updateSettingByKey = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await systemSettingsService.updateSetting(
    req.params.key,
    req.body,
    schoolId,
    req.user?.id
  );
  res.json(successResponse(record));
};

export const deleteSetting = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await systemSettingsService.deleteSetting(req.params.id, schoolId);
  res.json(successResponse(record));
};
