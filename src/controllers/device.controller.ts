import type { DeviceMode, DeviceType } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as deviceService from "../services/device.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const registerDevice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.registerDevice(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listDevices = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    mode: req.query.mode as DeviceMode | undefined,
    type: req.query.type as DeviceType | undefined,
    is_active:
      req.query.is_active === "true"
        ? true
        : req.query.is_active === "false"
          ? false
          : undefined
  };
  const result = await deviceService.findAllDevices(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getDevice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.findDeviceById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateDevice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.updateDevice(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deactivateDevice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.deactivateDevice(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const deleteDevice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.deleteDevice(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const pushStudentsToDevice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.pushStudentsToDevice(schoolId, req.params.id, req.body);
  res.status(200).json(successResponse(record));
};

/**
 * POST /devices/:id/remove-students
 * Remove students (and their fingerprints) from the biometric device.
 * Body: { mode: "selected"|"class"|"all", student_ids?, class_id?, section_id? }
 * The frontend must show double-confirm before calling this.
 */
export const removeStudentsFromDevice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.removeStudentsFromDevice(schoolId, req.params.id, req.body);
  res.status(200).json(successResponse(record));
};

export const getDeviceStatus = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.getDeviceStatus(schoolId, req.params.id);
  res.json(successResponse(record));
};

/**
 * GET /device/status - List all device statuses (optionally filtered by tabletId)
 * Used by the device logs page for device health monitoring
 */
export const listDeviceStatuses = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const tabletId = req.query.tabletId as string | undefined;
  const statuses = await deviceService.getAllDeviceStatuses(schoolId, tabletId);
  res.json(successResponse(statuses));
};

export const getDeviceAttendanceConfig = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.getDeviceAttendanceConfig(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const saveDeviceAttendanceConfig = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.saveDeviceAttendanceConfig(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const recordDeviceAttendanceEvent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.recordDeviceAttendanceEvent(schoolId, req.params.id, req.body);
  res.status(201).json(successResponse(record));
};

export const listDeviceLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    session_name: req.query.session_name as string | undefined,
    attendance_status: req.query.attendance_status as string | undefined
  };
  const record = await deviceService.listDeviceLogs(schoolId, req.params.id, pagination, filters);
  res.json(successResponse(record.data, record.meta));
};

export const createDeviceLog = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.createDeviceLog(schoolId, req.params.id, req.body);
  res.status(201).json(successResponse(record));
};

// Device Session Management Controllers

export const createDeviceSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.createDeviceSession(schoolId, req.params.id, req.body);
  res.status(201).json(successResponse(record));
};

export const getDeviceSessions = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.getDeviceSessions(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateDeviceSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.updateDeviceSession(
    schoolId,
    req.params.id,
    req.params.sessionId,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteDeviceSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.deleteDeviceSession(
    schoolId,
    req.params.id,
    req.params.sessionId
  );
  res.json(successResponse(record));
};

export const activateDeviceSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.activateDeviceSession(
    schoolId,
    req.params.id,
    req.params.sessionId
  );
  res.json(successResponse(record));
};

export const deactivateDeviceSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.deactivateDeviceSession(
    schoolId,
    req.params.id,
    req.params.sessionId
  );
  res.json(successResponse(record));
};

export const markStudentsAbsent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await deviceService.markStudentsAbsent(
    schoolId,
    req.params.id,
    req.params.sessionId,
    req.body
  );
  res.json(successResponse(record));
};
