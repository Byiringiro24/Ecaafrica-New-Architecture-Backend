import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as service from "../services/combination.service";

const schoolId = (req: Request) => {
  if (!req.user?.school_id) throw new AppError("forbidden", "Missing school context", 403);
  return req.user.school_id;
};

export const list = async (req: Request, res: Response) => { const result = await service.listCombinations(schoolId(req), parsePagination(req.query as Record<string, string>), req.query.include_deleted === "true"); res.json(successResponse(result.data, result.meta)); };
export const create = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.createCombination(schoolId(req), req.body)));
export const update = async (req: Request, res: Response) => res.json(successResponse(await service.updateCombination(schoolId(req), req.params.id, req.body)));
export const remove = async (req: Request, res: Response) => res.json(successResponse(await service.deleteCombination(schoolId(req), req.params.id)));
