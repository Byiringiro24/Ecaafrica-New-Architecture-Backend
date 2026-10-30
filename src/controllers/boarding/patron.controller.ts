import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as patronService from "../../services/boarding/patron.service";
import { getAssignedDormitoryIds } from "../../services/boarding/supervisor.service";
import { hasEffectiveRole } from "../../middleware/roleGuard";

const resolveSchoolId = (req: Request) => {
  const id = req.user?.school_id;
  if (!id) throw new AppError("forbidden", "Missing school context", 403);
  return id;
};

const assertOwnPatronResource = async (
  req: Request,
  dormitoryId: string,
) => {
  if (!hasEffectiveRole(req, "patron", "matron")) return;
  const assigned = await getAssignedDormitoryIds(
    resolveSchoolId(req),
    req.user!.id,
  );
  if (!assigned.some((id) => id === BigInt(dormitoryId))) {
    throw new AppError("forbidden", "You are not assigned to this dormitory", 403);
  }
};

export const listPatronAssignments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const userId = req.params.userId ?? req.user?.id;
  if (
    hasEffectiveRole(req, "patron", "matron") &&
    userId !== req.user!.id
  ) {
    throw new AppError("forbidden", "You can only view your own assignments", 403);
  }
  const data = await patronService.listPatronAssignments(schoolId, userId);
  res.json(successResponse(data));
};

export const listDormitoryPatrons = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  await assertOwnPatronResource(req, req.params.dormitoryId);
  const data = await patronService.listDormitoryPatrons(schoolId, req.params.dormitoryId);
  res.json(successResponse(data));
};

export const assignPatronToDormitories = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const userId = req.params.userId;
  const { dormitory_ids } = req.body as { dormitory_ids: string[] };
  if (!Array.isArray(dormitory_ids) || dormitory_ids.length === 0) {
    throw new AppError("bad_request", "dormitory_ids array is required", 400);
  }
  const assignedBy = req.user!.id;
  const data = await patronService.assignPatronToDormitories(schoolId, userId, dormitory_ids, assignedBy);
  res.status(201).json(successResponse(data));
};

export const removePatronFromDormitory = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const data = await patronService.removePatronFromDormitory(
    schoolId,
    req.params.userId,
    req.params.dormitoryId
  );
  res.json(successResponse(data));
};

/**
 * GET /boarding/patrons/me/devices
 * Returns devices assigned to dormitories this patron/matron is responsible for.
 * Used so patron can push students to the right biometric devices.
 */
export const listMyDevices = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const userId = req.user!.id;

  // Get dormitories assigned to this patron/matron
  const assignments = await patronService.listPatronAssignments(schoolId, userId);
  const dormitoryIds = assignments.map((a) => BigInt(a.dormitory_id));

  if (dormitoryIds.length === 0) {
    res.json(successResponse([]));
    return;
  }

  // Find devices assigned to those dormitories
  const { prisma } = await import("../../database/prisma");
  const devices = await prisma.devices.findMany({
    where: {
      school_id: BigInt(schoolId),
      dormitory_id: { in: dormitoryIds },
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      device_uid: true,
      mode: true,
      location: true,
      location_scope: true,
      location_label: true,
      dormitory_id: true,
      is_connected: true,
      last_seen_at: true,
      dormitory: { select: { id: true, name: true, block_name: true, hostel_name: true } },
      tablet: { select: { id: true, name: true, ip: true } },
    },
  });

  res.json(successResponse(devices.map((d) => ({
    ...d,
    id: d.id.toString(),
    dormitory_id: d.dormitory_id?.toString() ?? null,
    dormitory: d.dormitory ? { ...d.dormitory, id: d.dormitory.id.toString() } : null,
    tablet: d.tablet ? { ...d.tablet, id: d.tablet.id.toString() } : null,
  }))));
};
