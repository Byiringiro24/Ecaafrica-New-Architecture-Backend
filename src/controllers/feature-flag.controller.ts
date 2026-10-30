import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import * as featureFlagService from "../services/feature-flag.service";

export const listFeatureFlags = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await featureFlagService.findAllFeatureFlags(pagination);
  res.json(successResponse(result.data, result.meta));
};

export const getFeatureFlag = async (req: Request, res: Response) => {
  const record = await featureFlagService.findFeatureFlagById(req.params.id);
  res.json(successResponse(record));
};

export const getFeatureFlagByKey = async (req: Request, res: Response) => {
  const record = await featureFlagService.findFeatureFlagByKey(req.params.key);
  const schoolId = req.query.school_id as string | undefined;
  const enabled = await featureFlagService.isFeatureEnabled(req.params.key, schoolId);
  res.json(successResponse({ ...record, enabled_for_school: enabled }));
};

export const createFeatureFlag = async (req: Request, res: Response) => {
  const record = await featureFlagService.createFeatureFlag(req.body, req.user?.id);
  res.status(201).json(successResponse(record));
};

export const updateFeatureFlag = async (req: Request, res: Response) => {
  const record = await featureFlagService.updateFeatureFlag(
    req.params.id,
    req.body,
    req.user?.id
  );
  res.json(successResponse(record));
};

export const deleteFeatureFlag = async (req: Request, res: Response) => {
  const record = await featureFlagService.deleteFeatureFlag(req.params.id);
  res.json(successResponse(record));
};
