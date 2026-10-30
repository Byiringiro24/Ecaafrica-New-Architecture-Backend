import type { FeeAssignmentStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as assignmentService from "../../services/fees/assignment.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createAssignment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await assignmentService.assignFeeToStudent(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const bulkAssign = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await assignmentService.bulkAssignBySection(schoolId, req.body);
  res.status(201).json(successResponse(result));
};

export const listAssignments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    student_id: req.query.student_id as string | undefined,
    fee_structure_id: req.query.fee_structure_id as string | undefined,
    status: req.query.status as FeeAssignmentStatus | undefined
  };

  const result = await assignmentService.findAllAssignments(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getAssignment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await assignmentService.findAssignmentById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateAssignment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await assignmentService.updateAssignment(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteAssignment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await assignmentService.deleteAssignment(schoolId, req.params.id);
  res.json(successResponse(record));
};
