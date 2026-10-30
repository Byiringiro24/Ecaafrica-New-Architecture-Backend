import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as alertService from "../../services/boarding/alert.service";
import { getAssignedDormitoryIds } from "../../services/boarding/supervisor.service";
import { hasEffectiveRole } from "../../middleware/roleGuard";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

const resolveUserId = (req: Request) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("forbidden", "Missing user context", 403);
  }
  return userId;
};

export const createAlert = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await alertService.createAlert(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listAlerts = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const dormitory_ids =
    hasEffectiveRole(req, "patron", "matron")
      ? await getAssignedDormitoryIds(schoolId, req.user!.id)
      : undefined;
  const filters = {
    student_id: req.query.student_id as string | undefined,
    status: req.query.status as
      import("@prisma/client").AlertStatus | undefined,
    alert_type: req.query.alert_type as
      import("@prisma/client").AbsenceAlertType | undefined,
    severity: req.query.severity as
      import("@prisma/client").AlertSeverity | undefined,
    dormitory_ids,
  };
  const result = await alertService.listAlerts(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getAlert = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await alertService.findAlertById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateAlert = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await alertService.updateAlert(
    schoolId,
    req.params.id,
    req.body,
  );
  res.json(successResponse(record));
};

export const deleteAlert = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await alertService.deleteAlert(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const resolveAlert = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const userId = resolveUserId(req);
  const record = await alertService.resolveAlert(
    schoolId,
    req.params.id,
    userId,
    req.body.resolution_note,
  );
  res.json(successResponse(record));
};
