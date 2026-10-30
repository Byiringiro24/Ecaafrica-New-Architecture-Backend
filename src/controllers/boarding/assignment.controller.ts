import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as assignmentService from "../../services/boarding/assignment.service";
import { getAssignedDormitoryIds } from "../../services/boarding/supervisor.service";
import { hasEffectiveRole } from "../../middleware/roleGuard";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

const assertAssignedDormitoryAccess = async (
  req: Request,
  dormitoryId: string | number | bigint,
) => {
  if (!hasEffectiveRole(req, "patron", "matron")) return;
  const assigned = await getAssignedDormitoryIds(resolveSchoolId(req), req.user!.id);
  if (!assigned.some((id) => id === BigInt(dormitoryId))) {
    throw new AppError("forbidden", "You are not assigned to this dormitory", 403);
  }
};

export const createDormAssignment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  await assertAssignedDormitoryAccess(req, req.body.dormitory_id);
  // Use auto-push variant — non-blocking device push fires after assignment saved
  const record = await assignmentService.createDormAssignmentAndAutoPush(
    schoolId,
    req.body,
  );
  res.status(201).json(successResponse(record));
};

export const listDormAssignments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const dormitory_ids =
    hasEffectiveRole(req, "patron", "matron")
      ? await getAssignedDormitoryIds(schoolId, req.user!.id)
      : undefined;
  const isActiveParam = req.query.is_active;
  const isActiveValue = Array.isArray(isActiveParam)
    ? isActiveParam[0]
    : isActiveParam;
  const filters = {
    student_id: req.query.student_id as string | undefined,
    dormitory_id: req.query.dormitory_id as string | undefined,
    room_id: req.query.room_id as string | undefined,
    academic_year_id: req.query.academic_year_id as string | undefined,
    is_active:
      typeof isActiveValue === "string" ? isActiveValue === "true" : undefined,
    dormitory_ids,
    class_id: req.query.class_id as string | undefined,
  };
  const result = await assignmentService.listDormAssignments(
    schoolId,
    pagination,
    filters,
  );
  res.json(successResponse(result.data, result.meta));
};

export const getDormAssignment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await assignmentService.findDormAssignmentById(
    schoolId,
    req.params.id,
  );
  await assertAssignedDormitoryAccess(req, record.dormitory_id);
  res.json(successResponse(record));
};

export const listBoardingStudentsForAssignment = async (
  req: Request,
  res: Response,
) => {
  const role = hasEffectiveRole(req, "patron")
    ? "patron"
    : hasEffectiveRole(req, "matron")
      ? "matron"
      : req.user?.role;
  const data = await assignmentService.listBoardingStudentsForAssignment(
    resolveSchoolId(req),
    role,
  );
  res.json(successResponse(data));
};

export const createDormAssignments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const { student_ids, dormitory_id, academic_year_id, assigned_at } = req.body;
  await assertAssignedDormitoryAccess(req, dormitory_id);
  const inputs = student_ids.map((student_id: string) => ({
    student_id, dormitory_id, academic_year_id, assigned_at,
  }));
  // Use auto-push variant for each student
  const records = await Promise.all(
    inputs.map((input: Parameters<typeof assignmentService.createDormAssignmentAndAutoPush>[1]) =>
      assignmentService.createDormAssignmentAndAutoPush(schoolId, input)
    )
  );
  res.status(201).json(successResponse(records));
};

export const updateDormAssignment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const existing = await assignmentService.findDormAssignmentById(
    schoolId,
    req.params.id,
  );
  await assertAssignedDormitoryAccess(req, existing.dormitory_id);
  if (req.body.dormitory_id !== undefined) {
    await assertAssignedDormitoryAccess(req, req.body.dormitory_id);
  }
  const record = await assignmentService.updateDormAssignment(
    schoolId,
    req.params.id,
    req.body,
  );
  res.json(successResponse(record));
};

export const deleteDormAssignment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const existing = await assignmentService.findDormAssignmentById(
    schoolId,
    req.params.id,
  );
  await assertAssignedDormitoryAccess(req, existing.dormitory_id);
  const record = await assignmentService.deleteDormAssignment(
    schoolId,
    req.params.id,
  );
  res.json(successResponse(record));
};
