import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as structureService from "../../services/fees/structure.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createFeeStructure = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await structureService.createFeeStructure(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listFeeStructures = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    academic_year_id: req.query.academic_year_id as string | undefined,
    term_id: req.query.term_id as string | undefined,
    class_id: req.query.class_id as string | undefined
  };

  const result = await structureService.findAllFeeStructures(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getFeeStructure = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await structureService.findFeeStructureById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateFeeStructure = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await structureService.updateFeeStructure(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteFeeStructure = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await structureService.deleteFeeStructure(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const cloneFeeStructure = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await structureService.cloneFeeStructureToTerm(
    schoolId,
    req.params.id,
    req.body
  );
  res.status(201).json(successResponse(record));
};
