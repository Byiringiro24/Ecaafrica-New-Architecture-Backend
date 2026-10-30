import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as leaveV2 from "../../services/boarding/leave-v2.service";
import * as leaveService from "../../services/boarding/leave.service";
import { getAssignedDormitoryIds } from "../../services/boarding/supervisor.service";

const schoolId = (req: Request) => {
  const id = req.user?.school_id;
  if (!id) throw new AppError("forbidden", "Missing school context", 403);
  return id;
};

// Enhanced create — full state machine
export const createLeave = async (req: Request, res: Response) => {
  const data = await leaveV2.createLeaveV2(schoolId(req), {
    ...req.body,
    requested_by_role: req.user?.role,
    created_by: req.user?.id,
  });
  res.status(201).json(successResponse(data));
};

// List — delegate to existing service (already handles filters)
export const listLeaves = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const effectiveRoles = [
    req.user?.role,
    ...(Array.isArray(req.user?.secondary_roles) ? req.user.secondary_roles : []),
  ].filter(Boolean);
  const isPatronOrMatron = effectiveRoles.some((role) => role === "patron" || role === "matron");
  const assignedDormitoryIds = isPatronOrMatron
    ? await getAssignedDormitoryIds(schoolId(req), req.user!.id)
    : undefined;
  const data = await leaveService.listStudentLeaves(schoolId(req), pagination, {
    student_id: req.query.student_id as string,
    status: req.query.status as any,
    from_date: req.query.from_date as string,
    to_date: req.query.to_date as string,
    is_unauthorized: req.query.is_unauthorized === "true" ? true : undefined,
    dormitory_ids: assignedDormitoryIds,
  });
  res.json(successResponse(data.data, data.meta));
};

export const getLeave = async (req: Request, res: Response) => {
  const data = await leaveService.findStudentLeaveById(schoolId(req), req.params.id);
  res.json(successResponse(data));
};

export const approveLeave = async (req: Request, res: Response) => {
  const data = await leaveV2.approveLeaveV2(schoolId(req), req.params.id, req.user!.id);
  res.json(successResponse(data));
};

export const rejectLeave = async (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason) throw new AppError("bad_request", "Rejection reason is required", 400);
  const data = await leaveV2.rejectLeaveV2(schoolId(req), req.params.id, req.user!.id, reason);
  res.json(successResponse(data));
};

export const confirmGateExit = async (req: Request, res: Response) => {
  // Spec §6 + §16: student photo is mandatory before gate exit
  const leaveInfo = await leaveV2.getLeaveForPhotoCheck(schoolId(req), req.params.id);
  if (leaveInfo?.student_id) {
    await leaveV2.assertStudentHasPhoto(schoolId(req), leaveInfo.student_id);
  }
  const data = await leaveV2.confirmGateExit(
    schoolId(req), req.params.id, req.user!.id, req.body.notes
  );
  res.json(successResponse(data));
};

// Patron/Matron confirms student return (RETURNED → CLOSED, spec §21)
export const confirmReturn = async (req: Request, res: Response) => {
  const data = await leaveV2.confirmReturnByPatron(
    schoolId(req), req.params.id, req.user!.id
  );
  res.json(successResponse(data));
};

export const getApprovedExits = async (req: Request, res: Response) => {
  const data = await leaveV2.getApprovedExitsForGateKeeper(schoolId(req), {
    date: req.query.date as string,
  });
  res.json(successResponse(data));
};
