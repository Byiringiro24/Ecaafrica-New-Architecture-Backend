import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as rollCallService from "../../services/boarding/roll-call.service";
import { getAssignedDormitoryIds } from "../../services/boarding/supervisor.service";
import { hasEffectiveRole } from "../../middleware/roleGuard";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createRollCall = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const { dormitory_id, session_type, ...rest } = req.body;
  const record = await rollCallService.createRollCall(
    schoolId,
    dormitory_id,
    session_type,
    rest,
  );
  res.status(201).json(successResponse(record));
};

export const listRollCalls = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const dormitory_ids =
    hasEffectiveRole(req, "patron", "matron")
      ? await getAssignedDormitoryIds(schoolId, req.user!.id)
      : undefined;
  const filters = {
    dormitory_id: req.query.dormitory_id as string | undefined,
    roll_date: req.query.roll_date as string | undefined,
    session_type: req.query.session_type as
      import("@prisma/client").BoardingSessionType | undefined,
    dormitory_ids,
  };
  const result = await rollCallService.listRollCalls(
    schoolId,
    pagination,
    filters,
  );
  res.json(successResponse(result.data, result.meta));
};

export const getRollCall = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await rollCallService.findRollCallById(
    schoolId,
    req.params.id,
  );
  res.json(successResponse(record));
};

export const updateRollCall = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await rollCallService.updateRollCall(
    schoolId,
    req.params.id,
    req.body,
  );
  res.json(successResponse(record));
};

export const deleteRollCall = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await rollCallService.deleteRollCall(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const submitRollCallRecord = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await rollCallService.submitRollCallRecord(
    schoolId,
    req.params.id,
    req.body,
  );
  res.status(201).json(successResponse(record));
};

export const bulkSubmitRollCall = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const records = await rollCallService.bulkSubmitRollCall(
    schoolId,
    req.params.id,
    req.body.records,
  );
  res.status(201).json(successResponse(records));
};

export const getRollCallSummary = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const summary = await rollCallService.getRollCallSummary(
    schoolId,
    req.params.id,
  );
  res.json(successResponse(summary));
};

export const getRollCallRoster = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const roster = await rollCallService.getRollCallRoster(
    schoolId,
    req.params.id,
  );
  res.json(successResponse(roster));
};
