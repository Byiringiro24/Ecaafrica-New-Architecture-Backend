import type { EmploymentStatus, StaffContractType } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as profileService from "../../services/staff/profile.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createStaffProfile = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await profileService.createStaffProfile(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listStaffProfiles = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    department: req.query.department as string | undefined,
    employment_status: req.query.employment_status as EmploymentStatus | undefined,
    contract_type: req.query.contract_type as StaffContractType | undefined
  };
  const result = await profileService.findAllStaffProfiles(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getStaffProfile = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await profileService.findStaffProfileById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const getMyStaffProfile = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("unauthorized", "Missing user context", 401);
  }

  const record = await profileService.findStaffProfileByUserId(schoolId, userId);
  res.json(successResponse(record));
};

export const updateStaffProfile = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await profileService.updateStaffProfile(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteStaffProfile = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await profileService.deleteStaffProfile(schoolId, req.params.id);
  res.json(successResponse(record));
};
