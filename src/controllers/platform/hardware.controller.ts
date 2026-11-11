import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import tabletService from "../../services/tablet.service";
import * as deviceService from "../../services/device.service";
import { resetTabletSSE } from "../../jobs/bridge-sse.job";

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const resolveSchoolIdFromBody = (req: Request) => {
  const schoolId = req.body?.school_id ?? req.query?.school_id;
  if (!schoolId) {
    throw new AppError("bad_request", "school_id is required", 400);
  }
  return toBigInt(schoolId);
};

export const listTablets = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const schoolId = req.query.school_id ? toBigInt(req.query.school_id as string) : undefined;

  const where = {
    deleted_at: null,
    ...(schoolId ? { school_id: schoolId } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.tablets.findMany({
      where,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: { created_at: "desc" },
      include: { school: { select: { id: true, name: true } } },
    }),
    prisma.tablets.count({ where }),
  ]);

  res.json(successResponse(items, { ...pagination, total }));
};

export const createTablet = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolIdFromBody(req);
  const tablet = await tabletService.createTablet(req.body, schoolId);
  res.status(201).json(successResponse({ tablet }));
};

export const updateTablet = async (req: Request, res: Response) => {
  const existing = await prisma.tablets.findFirst({
    where: { id: toBigInt(req.params.id), deleted_at: null },
  });
  if (!existing) throw new AppError("not_found", "Tablet not found", 404);

  const { school_id, ...restBody } = req.body as Record<string, unknown>;

  // Apply standard field updates (ip, port, name, location, notes etc.)
  const updateData = { ...restBody } as Record<string, unknown>;
  const tablet = await tabletService.updateTablet(existing.id, updateData as any, existing.school_id);

  // If school_id is being changed, update the tablet AND all linked devices
  if (school_id && toBigInt(school_id as any) !== existing.school_id) {
    const newSchoolId = toBigInt(school_id as any);

    // Move tablet to new school
    const reassigned = await prisma.tablets.update({
      where: { id: existing.id },
      data: { school_id: newSchoolId, updated_at: new Date() },
    });

    // Move all linked devices to the new school + reset connection state
    await prisma.devices.updateMany({
      where: { tablet_id: existing.id },
      data: {
        school_id: newSchoolId,
        is_connected: false,
        last_connection_at: null,
        connection_error: 'Reassigned to new school — will reconnect automatically',
        updated_at: new Date(),
      },
    });

    // Reset SSE stream so it reconnects with new school context
    resetTabletSSE(existing.id);

    return res.json(successResponse({ tablet: reassigned }));
  }

  res.json(successResponse({ tablet }));
};

export const deleteTablet = async (req: Request, res: Response) => {
  const existing = await prisma.tablets.findFirst({
    where: { id: toBigInt(req.params.id), deleted_at: null },
  });
  if (!existing) throw new AppError("not_found", "Tablet not found", 404);

  await tabletService.deleteTablet(existing.id, existing.school_id);
  res.json(successResponse(null));
};

/**
 * Live ping a tablet bridge over WireGuard VPN.
 * Returns { healthy: true/false, responseTime, error } without requiring school context.
 * Used by the super-admin hardware page to get real-time reachability.
 */
export const pingTablet = async (req: Request, res: Response) => {
  const existing = await prisma.tablets.findFirst({
    where: { id: toBigInt(req.params.id), deleted_at: null },
  });
  if (!existing) throw new AppError("not_found", "Tablet not found", 404);

  const health = await tabletService.checkHealth(existing.id, existing.school_id).catch((err) => ({
    healthy: false,
    responseTime: 0,
    error: (err as Error).message,
    timestamp: new Date(),
  }));

  res.json(successResponse(health));
};

export const listDevices = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const schoolId = req.query.school_id ? toBigInt(req.query.school_id as string) : undefined;

  const where = {
    ...(schoolId ? { school_id: schoolId } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.devices.findMany({
      where,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: { created_at: "desc" },
      include: {
        school: { select: { id: true, name: true } },
        tablet: { select: { id: true, name: true, ip: true, port: true } },
      },
    }),
    prisma.devices.count({ where }),
  ]);

  res.json(successResponse(items, { ...pagination, total }));
};

export const createDevice = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolIdFromBody(req);
  const record = await deviceService.registerDevice(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const updateDevice = async (req: Request, res: Response) => {
  const existing = await prisma.devices.findFirst({
    where: { id: toBigInt(req.params.id) },
  });
  if (!existing) throw new AppError("not_found", "Device not found", 404);

  // Pull out school_id so device.service doesn't choke on it
  const { school_id, ...restBody } = req.body as Record<string, unknown>;

  // Apply standard field updates (tablet_id, name, mode, etc.) through the service
  const record = await deviceService.updateDevice(existing.school_id, req.params.id, restBody as any);

  // If school_id is being changed, apply it directly (bypasses ownership check)
  if (school_id && toBigInt(school_id as any) !== existing.school_id) {
    const reassigned = await prisma.devices.update({
      where: { id: existing.id },
      data: { school_id: toBigInt(school_id as any), updated_at: new Date() },
    });
    return res.json(successResponse(reassigned));
  }

  res.json(successResponse(record));
};

export const deleteDevice = async (req: Request, res: Response) => {
  const existing = await prisma.devices.findFirst({
    where: { id: toBigInt(req.params.id) },
  });
  if (!existing) throw new AppError("not_found", "Device not found", 404);

  const record = await deviceService.deleteDevice(existing.school_id, req.params.id);
  res.json(successResponse(record));
};

/**
 * PATCH /platform/hardware/tablets/:id/dev-password
 * Super admin sets a new developer password for a specific tablet.
 * The tablet bridge polls /api/v1/tablet-bridge/dev-password/:uuid and applies it.
 * Body: { password: string } — or { password: null } to remove the password.
 */
export const setTabletDevPassword = async (req: import("express").Request, res: import("express").Response) => {
  const { password } = req.body as { password?: string | null };
  const isRemoval = password === null || password === "";
  if (!isRemoval && (!password || password.trim().length < 4)) {
    throw new AppError("bad_request", "Password must be at least 4 characters, or send null to remove", 400);
  }

  const existing = await prisma.tablets.findFirst({
    where: { id: toBigInt(req.params.id), deleted_at: null },
  });
  if (!existing) throw new AppError("not_found", "Tablet not found", 404);

  await prisma.tablets.update({
    where: { id: existing.id },
    data: {
      dev_password: isRemoval ? null : password!.trim(),
      dev_password_set_at: isRemoval ? null : new Date(),
      updated_at: new Date(),
    } as any,
  });

  res.json(successResponse({
    updated: true,
    tablet: (existing as any).name,
    removed: isRemoval,
    setAt: isRemoval ? null : new Date(),
  }));
};

/**
 * PATCH /platform/hardware/tablets/dev-password/all
 * Super admin sets OR removes the developer password for ALL tablets at once.
 * Body: { password: string } — or { password: null } to remove from all.
 */
export const setAllTabletsDevPassword = async (req: import("express").Request, res: import("express").Response) => {
  const { password } = req.body as { password?: string | null };
  const isRemoval = password === null || password === "";
  if (!isRemoval && (!password || password.trim().length < 4)) {
    throw new AppError("bad_request", "Password must be at least 4 characters, or send null to remove from all", 400);
  }

  const result = await prisma.tablets.updateMany({
    where: { deleted_at: null },
    data: {
      dev_password: isRemoval ? null : password!.trim(),
      dev_password_set_at: isRemoval ? null : new Date(),
      updated_at: new Date(),
    } as any,
  });

  res.json(successResponse({
    updated: result.count,
    removed: isRemoval,
    setAt: isRemoval ? null : new Date(),
  }));
};

/**
 * GET /platform/hardware/tablets/:uuid/dev-password  (platform-auth)
 * Returns whether a password has been set and when.
 */
export const getTabletDevPassword = async (req: import("express").Request, res: import("express").Response) => {
  const tablet = await prisma.tablets.findFirst({
    where: { uuid: req.params.uuid, deleted_at: null },
    select: { id: true, name: true } as any,
  });
  if (!tablet) throw new AppError("not_found", "Tablet not found", 404);

  res.json(successResponse({
    hasPassword: !!(tablet as any).dev_password,
    setAt: (tablet as any).dev_password_set_at,
  }));
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM DEVICE PROXY — /platform/hardware/tablets/:id/device/*
// Super admin controls FK623 devices over WireGuard VPN via the tablet bridge.
// Resolves school_id from the tablet's DB record (not from req.user).
// ═══════════════════════════════════════════════════════════════════════════════

/** Helper: resolve tablet + schoolId from the DB for platform-auth proxy */
async function resolveTabletForProxy(tabletId: string) {
  const tablet = await prisma.tablets.findFirst({
    where: { id: toBigInt(tabletId), deleted_at: null },
  });
  if (!tablet) throw new AppError("not_found", "Tablet not found", 404);
  return { tablet, schoolId: tablet.school_id };
}

/** GET /platform/hardware/tablets/:id/device/status */
export const proxyDeviceStatus = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const result = await tabletService.getDeviceStatus(req.params.id, schoolId);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/connect */
export const proxyDeviceConnect = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const result = await tabletService.connectDevice(req.params.id, schoolId, req.body);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/disconnect */
export const proxyDeviceDisconnect = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const result = await tabletService.disconnectDevice(req.params.id, schoolId);
  res.json(successResponse(result));
};

/** GET /platform/hardware/tablets/:id/device/users */
export const proxyGetDeviceUsers = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const result = await tabletService.getDeviceUsers(req.params.id, schoolId);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/users — add user */
export const proxyAddDeviceUser = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const { userId, name, photoUrl } = req.body;
  if (!userId) throw new AppError("bad_request", "userId is required", 400);
  if (!name) throw new AppError("bad_request", "name is required", 400);
  const result = await tabletService.addDeviceUser(req.params.id, schoolId, { userId, name, photoUrl });
  res.status(201).json(successResponse(result));
};

/** DELETE /platform/hardware/tablets/:id/device/users/:userId */
export const proxyDeleteDeviceUser = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const userId = req.params.userId;
  if (!userId) throw new AppError("bad_request", "userId is required", 400);
  const result = await tabletService.deleteDeviceUser(req.params.id, schoolId, userId);
  res.json(successResponse(result));
};

/** PATCH /platform/hardware/tablets/:id/device/users/:userId — rename user */
export const proxyRenameDeviceUser = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const userId = req.params.userId;
  const { name } = req.body;
  if (!userId) throw new AppError("bad_request", "userId is required", 400);
  if (!name) throw new AppError("bad_request", "name is required", 400);
  const result = await tabletService.renameDeviceUser(req.params.id, schoolId, userId, name);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/push-students */
export const proxyPushStudents = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const { studentIds } = req.body;
  // Build input compatible with the existing pushStudentsToDevice signature
  const input = studentIds?.length
    ? { mode: 'selected' as const, student_ids: studentIds }
    : { mode: 'all' as const };
  const result = await tabletService.pushStudentsToDevice(req.params.id, schoolId, input as any);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/pull-logs */
export const proxyPullLogs = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const readMark = req.body?.readMark === 1 ? 1 : 0;
  const result = await tabletService.pullDeviceLogs(req.params.id, schoolId, readMark);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/sync-time */
export const proxySyncTime = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const result = await tabletService.syncTime(req.params.id, schoolId);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/clear-logs */
export const proxyClearLogs = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const result = await tabletService.clearDeviceLogs(req.params.id, schoolId);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/clear-all */
export const proxyClearAll = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const result = await tabletService.clearDeviceData(req.params.id, schoolId);
  res.json(successResponse(result));
};

/** POST /platform/hardware/tablets/:id/device/poweroff */
export const proxyPowerOff = async (req: Request, res: Response) => {
  const { schoolId } = await resolveTabletForProxy(req.params.id);
  const result = await tabletService.powerOffDevice(req.params.id, schoolId);
  res.json(successResponse(result));
};
