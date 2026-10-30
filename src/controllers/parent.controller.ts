import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as parentService from "../services/parent.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const parent = await parentService.createParent(schoolId, req.body);
  res.status(201).json(successResponse(parent));
};

export const listParents = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    q: req.query.q as string | undefined
  };

  const result = await parentService.findAllParents(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const parent = await parentService.findParentById(schoolId, req.params.id);
  res.json(successResponse(parent));
};

export const updateParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const parent = await parentService.updateParent(schoolId, req.params.id, req.body);
  res.json(successResponse(parent));
};

export const deleteParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const parent = await parentService.deleteParent(schoolId, req.params.id);
  res.json(successResponse(parent));
};

export const linkParentToStudent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const { parent_id, is_primary } = req.body;

  const link = await parentService.linkParentToStudent(
    schoolId,
    req.params.id,
    parent_id,
    is_primary
  );
  res.status(201).json(successResponse(link));
};

export const unlinkParentFromStudent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await parentService.unlinkParentFromStudent(
    schoolId,
    req.params.id,
    req.params.parentId
  );
  res.json(successResponse(result));
};
