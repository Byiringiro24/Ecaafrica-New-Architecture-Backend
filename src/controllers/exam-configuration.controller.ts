import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as service from "../services/exam-configuration.service";

const schoolId = (req: Request) => {
  if (!req.user?.school_id) throw new AppError("forbidden", "Missing school context", 403);
  return String(req.user.school_id);
};

export const listExamTypes = async (req: Request, res: Response) => res.json(successResponse(await service.listExamTypes(schoolId(req), req.query.include_inactive === "true")));
export const createExamType = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.createExamType(schoolId(req), req.body)));
export const updateExamType = async (req: Request, res: Response) => res.json(successResponse(await service.updateExamType(String(schoolId(req)), req.params.id, req.body)));

export const listGradingRoles = async (req: Request, res: Response) => res.json(successResponse(await service.listGradingRoles(schoolId(req), req.query.include_inactive === "true")));
export const createGradingRole = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.createGradingRole(schoolId(req), req.body)));
export const updateGradingRole = async (req: Request, res: Response) => res.json(successResponse(await service.updateGradingRole(schoolId(req), req.params.id, req.body)));
