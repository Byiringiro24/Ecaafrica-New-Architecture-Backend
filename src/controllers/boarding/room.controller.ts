import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as roomService from "../../services/boarding/room.service";
import { getAssignedDormitoryIds } from "../../services/boarding/supervisor.service";
import { hasEffectiveRole } from "../../middleware/roleGuard";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createDormRoom = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await roomService.createDormRoom(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listDormRooms = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const dormitory_ids = hasEffectiveRole(req, "patron", "matron")
    ? await getAssignedDormitoryIds(schoolId, req.user!.id)
    : undefined;
  const filters = {
    dormitory_id: req.query.dormitory_id as string | undefined,
    dormitory_ids
  };
  const result = await roomService.listDormRooms(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getDormRoom = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await roomService.findDormRoomById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateDormRoom = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await roomService.updateDormRoom(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteDormRoom = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await roomService.deleteDormRoom(schoolId, req.params.id);
  res.json(successResponse(record));
};
