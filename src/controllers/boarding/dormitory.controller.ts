import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as dormitoryService from "../../services/boarding/dormitory.service";
import { getAssignedDormitoryIds } from "../../services/boarding/supervisor.service";
import { hasEffectiveRole } from "../../middleware/roleGuard";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createDormitory = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await dormitoryService.createDormitory(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listDormitories = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const dormitory_ids =
    hasEffectiveRole(req, "patron", "matron")
      ? await getAssignedDormitoryIds(schoolId, req.user!.id)
      : undefined;
  const filters = {
    gender: req.query.gender as import("@prisma/client").DormGender | undefined,
    dormitory_ids,
  };
  const result = await dormitoryService.listDormitories(
    schoolId,
    pagination,
    filters,
  );
  res.json(successResponse(result.data, result.meta));
};

export const getDormitory = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await dormitoryService.findDormitoryById(
    schoolId,
    req.params.id,
  );
  res.json(successResponse(record));
};

export const updateDormitory = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await dormitoryService.updateDormitory(
    schoolId,
    req.params.id,
    req.body,
  );
  res.json(successResponse(record));
};

export const deleteDormitory = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await dormitoryService.deleteDormitory(
    schoolId,
    req.params.id,
  );
  res.json(successResponse(record));
};
