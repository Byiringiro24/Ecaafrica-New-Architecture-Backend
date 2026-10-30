import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as leaveService from "../../services/boarding/leave.service";
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

export const createStudentLeave = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveService.createStudentLeave(schoolId, {
    ...req.body,
    requested_by: req.body.requested_by ?? req.user?.id,
    source:
      req.body.source ??
      (hasEffectiveRole(req, "patron", "matron")
        ? "patron_matron"
        : "dod"),
  });
  res.status(201).json(successResponse(record));
};

export const listStudentLeaves = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const dormitory_ids =
    hasEffectiveRole(req, "patron", "matron")
      ? await getAssignedDormitoryIds(schoolId, req.user!.id)
      : undefined;
  const isUnauthorizedParam = req.query.is_unauthorized;
  const isUnauthorizedValue = Array.isArray(isUnauthorizedParam)
    ? isUnauthorizedParam[0]
    : isUnauthorizedParam;
  const filters = {
    student_id: req.query.student_id as string | undefined,
    status: req.query.status as
      import("@prisma/client").StudentLeaveStatus | undefined,
    from_date: req.query.from_date as string | undefined,
    to_date: req.query.to_date as string | undefined,
    is_unauthorized:
      typeof isUnauthorizedValue === "string"
        ? isUnauthorizedValue === "true"
        : undefined,
    dormitory_ids,
  };
  const result = await leaveService.listStudentLeaves(
    schoolId,
    pagination,
    filters,
  );
  res.json(successResponse(result.data, result.meta));
};

export const getStudentLeave = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveService.findStudentLeaveById(
    schoolId,
    req.params.id,
  );
  res.json(successResponse(record));
};

export const updateStudentLeave = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveService.updateStudentLeave(
    schoolId,
    req.params.id,
    req.body,
  );
  res.json(successResponse(record));
};

export const deleteStudentLeave = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await leaveService.deleteStudentLeave(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const approveStudentLeave = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const userId = resolveUserId(req);
  const record = await leaveService.approveStudentLeave(
    schoolId,
    req.params.id,
    userId,
  );
  res.json(successResponse(record));
};

export const rejectStudentLeave = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const userId = resolveUserId(req);
  const record = await leaveService.rejectStudentLeave(
    schoolId,
    req.params.id,
    userId,
    req.body.rejection_reason,
  );
  res.json(successResponse(record));
};

export const requestLeaveClarification = async (
  req: Request,
  res: Response,
) => {
  const record = await leaveService.requestLeaveClarification(
    resolveSchoolId(req),
    req.params.id,
    req.body.clarification_note,
  );
  res.json(successResponse(record));
};
