import { GateEventType, ScanMethod } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as gateLogService from "../../services/gate/log.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createGateLog = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await gateLogService.logEvent(
    schoolId,
    req.body.student_id,
    req.body.event_type as GateEventType,
    (req.body.scan_method as ScanMethod) ?? ScanMethod.manual,
    req.body.device_id
  );
  res.status(201).json(successResponse(record));
};

export const listGateLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    student_id: req.query.student_id as string | undefined,
    event_type: req.query.event_type as GateEventType | undefined,
    scan_method: req.query.scan_method as ScanMethod | undefined,
    device_id: req.query.device_id as string | undefined,
    is_flagged: req.query.is_flagged as boolean | undefined,
    date: req.query.date as string | undefined
  };

  const result = await gateLogService.getLogs(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getGateLog = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const log = await gateLogService.findGateLogById(schoolId, req.params.id);
  res.json(successResponse(log));
};

export const updateGateLog = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const log = await gateLogService.updateGateLog(schoolId, req.params.id, req.body);
  res.json(successResponse(log));
};

export const deleteGateLog = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const log = await gateLogService.deleteGateLog(schoolId, req.params.id);
  res.json(successResponse(log));
};

export const getActiveStudentsOnCampus = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const students = await gateLogService.getActiveStudentsOnCampus(schoolId);
  res.json(successResponse(students));
};
