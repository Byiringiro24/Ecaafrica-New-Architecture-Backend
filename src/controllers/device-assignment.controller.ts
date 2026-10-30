import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as assignmentService from "../services/device-assignment.service";

const resolveSchoolId = (req: Request) => {
  const id = req.user?.school_id;
  if (!id) throw new AppError("forbidden", "Missing school context", 403);
  return id;
};

/** PATCH /devices/:id/assign-location — assign device to location (optionally auto-push) */
export const assignDeviceLocation = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const autoPush = req.body.auto_push !== false; // default true
  const data = await assignmentService.assignDeviceLocationAndPush(
    schoolId, req.params.id,
    { ...req.body, auto_push: autoPush },
    req.user!.id
  );
  res.json(successResponse(data));
};

/** GET /devices/locations — list all devices with their location info */
export const listDevicesWithLocation = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const data = await assignmentService.listDevicesWithLocation(schoolId, {
    dormitory_id:   req.query.dormitory_id as string,
    location_scope: req.query.location_scope as any,
  });
  res.json(successResponse(data));
};

/**
 * GET /devices/:id/assigned-students
 * Returns students assigned to this device based on its location_scope.
 * Groups into pages of 2000 (device capacity).
 * Query params: ?group=1 to get a specific group (default all groups returned)
 */
export const getAssignedStudents = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const data = await assignmentService.getStudentsForDevice(schoolId, req.params.id);
  res.json(successResponse(data));
};

/**
 * POST /devices/:id/push-group
 * Push a specific student group to the tablet linked to this device.
 * Body: { group: 1 } (1-indexed)
 */
export const pushStudentGroup = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const { group = 1 } = req.body;
  const data = await assignmentService.assignDeviceLocationAndPush(
    schoolId, req.params.id,
    { auto_push: true, group: Number(group) },
    req.user!.id
  );
  res.status(201).json(successResponse(data));
};
