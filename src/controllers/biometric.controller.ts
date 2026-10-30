import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as biometricService from "../services/biometric.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createBiometricEnrollment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const enrolledBy = req.user?.id;

  const enrollment = await biometricService.createBiometricEnrollment(schoolId, {
    ...req.body,
    enrolled_by: enrolledBy ?? req.body.enrolled_by
  });

  res.status(201).json(successResponse(enrollment));
};

export const listBiometricEnrollments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    student_id: req.query.student_id as string | undefined,
    type: req.query.type as string | undefined,
    is_active: req.query.is_active as boolean | undefined
  };

  const result = await biometricService.findAllBiometricEnrollments(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getBiometricEnrollment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const enrollment = await biometricService.findBiometricEnrollmentById(
    schoolId,
    req.params.id
  );
  res.json(successResponse(enrollment));
};

export const updateBiometricEnrollment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const enrollment = await biometricService.updateBiometricEnrollment(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(enrollment));
};

export const deleteBiometricEnrollment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const enrollment = await biometricService.deleteBiometricEnrollment(
    schoolId,
    req.params.id
  );
  res.json(successResponse(enrollment));
};
