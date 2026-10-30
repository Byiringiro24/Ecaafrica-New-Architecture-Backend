import type { VisitorType } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as visitorService from "../services/visitor.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createVisitor = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await visitorService.createVisitor(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listVisitors = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    visitor_type: req.query.visitor_type as VisitorType | undefined
  };
  const result = await visitorService.findAllVisitors(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getVisitor = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await visitorService.findVisitorById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateVisitor = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await visitorService.updateVisitor(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteVisitor = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await visitorService.deleteVisitor(schoolId, req.params.id);
  res.json(successResponse(record));
};
