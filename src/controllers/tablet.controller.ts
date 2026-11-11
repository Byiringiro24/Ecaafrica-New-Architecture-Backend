// Adapted from migration/Attendance_device_config_backend/src/controllers/tablets.js

import { Request, Response } from 'express';
import tabletService from '../services/tablet.service';
import { successResponse } from '../helpers/response';
import { AppError } from '../middleware/errorHandler';
import { TabletStatus } from '../types/tablet.types';
import { prisma } from '../database/prisma';

const resolveSchoolId = (req: Request): bigint => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError('forbidden', 'Missing school context', 403);
  }
  if (typeof schoolId === 'bigint') return schoolId;
  if (typeof schoolId === 'number') return BigInt(schoolId);
  return BigInt(schoolId);
};

/**
 * Get all tablets with pagination and filters
 */
export async function getAllTablets(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const { page, limit, status, search, is_active } = req.query as any;

  const result = await tabletService.listTablets(
    schoolId,
    { status, search, is_active },
    Number(page) || 1,
    Number(limit) || 10
  );

  res.json(successResponse(result));
}

/**
 * Get single tablet by ID
 */
export async function getTablet(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const id = BigInt(req.params.id);

  const tablet = await tabletService.getTablet(id, schoolId);
  if (!tablet) {
    throw new AppError('not_found', 'Tablet not found', 404);
  }

  res.json(successResponse({ tablet }));
}

/**
 * Register a new tablet
 */
export async function registerTablet(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const tabletData = req.body;

  const tablet = await tabletService.createTablet(tabletData, schoolId);

  res.status(201).json(successResponse({ tablet }));
}

/**
 * Update tablet
 */
export async function updateTablet(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const id = BigInt(req.params.id);
  const updateData = req.body;

  const tablet = await tabletService.updateTablet(id, updateData, schoolId);

  res.json(successResponse({ tablet }));
}

/**
 * Delete tablet (soft delete)
 */
export async function deleteTablet(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const id = BigInt(req.params.id);

  await tabletService.deleteTablet(id, schoolId);

  res.json(successResponse(null));
}

/**
 * Check tablet health
 */
export async function checkTabletHealth(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const id = BigInt(req.params.id);

  const health = await tabletService.checkHealth(id, schoolId);

  res.json(successResponse(health));
}

/**
 * Update tablet status
 */
export async function updateTabletStatus(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const id = BigInt(req.params.id);
  const { status } = req.body;

  if (!['online', 'offline', 'error', 'maintenance'].includes(status)) {
    throw new AppError('bad_request', 'Invalid status', 400);
  }

  const tablet = await tabletService.updateStatus(id, status as TabletStatus, schoolId);

  res.json(successResponse({ tablet }));
}

export async function getTabletDeviceStatus(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const result = await tabletService.getDeviceStatus(req.params.id, schoolId);
  res.json(successResponse({ data: result }));
}

export async function connectTabletDevice(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const result = await tabletService.connectDevice(req.params.id, schoolId, req.body);
  res.json(successResponse({ data: result }));
}

export async function disconnectTabletDevice(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const result = await tabletService.disconnectDevice(req.params.id, schoolId);
  res.json(successResponse(result));
}

export async function syncTabletDeviceTime(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const result = await tabletService.syncTime(req.params.id, schoolId);
  res.json(successResponse(result));
}

export async function setTabletDeviceTime(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const result = await tabletService.setTime(
    req.params.id,
    schoolId,
    req.body.datetime || new Date().toISOString()
  );
  res.json(successResponse(result));
}

export async function pullTabletDeviceUsers(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  // deviceUid: optional query param — routes to specific FK623 on multi-device tablets
  const deviceUid = (req.query.deviceUid as string) || null;
  const result = await tabletService.getDeviceUsers(req.params.id, schoolId, deviceUid);
  res.json(successResponse({ data: result }));
}

export async function addTabletDeviceUser(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  // deviceUid may come from body or query
  const deviceUid = (req.body.deviceUid as string) || (req.query.deviceUid as string) || null;
  const result = await tabletService.addDeviceUser(req.params.id, schoolId, { ...req.body, deviceUid });
  res.json(successResponse(result));
}

export async function deleteTabletDeviceUser(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const deviceUid = (req.query.deviceUid as string) || null;
  const result = await tabletService.deleteDeviceUser(req.params.id, schoolId, req.params.userId, deviceUid);
  res.json(successResponse(result));
}

export async function pullTabletDeviceLogs(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const result = await tabletService.pullDeviceLogs(
    req.params.id,
    schoolId,
    Number(req.body.readMark ?? 0)
  );
  res.json(successResponse({ data: result }));
}

export async function pushTabletDeviceStudents(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const result = await tabletService.pushStudentsToDevice(req.params.id, schoolId, req.body);
  res.json(successResponse(result));
}

export async function clearTabletDeviceLogs(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const deviceUid = (req.query.deviceUid as string) || null;
  const result = await tabletService.clearDeviceLogs(req.params.id, schoolId, deviceUid);
  res.json(successResponse(result));
}

export async function clearTabletDeviceData(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const deviceUid = (req.query.deviceUid as string) || null;
  const result = await tabletService.clearDeviceData(req.params.id, schoolId, deviceUid);
  res.json(successResponse(result));
}

export async function powerOffTabletDevice(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const result = await tabletService.powerOffDevice(req.params.id, schoolId);
  res.json(successResponse(result));
}

/**
 * GET /tablets - List tablets for device logs feature
 * Used by the device logs page for device health monitoring
 */
export async function listTabletsForDeviceLogs(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);
  const { status, is_active, page, limit } = req.query as any;

  // Build filters object
  const filters: any = {};
  if (status) filters.status = status as TabletStatus;
  if (is_active !== undefined) filters.is_active = is_active === 'true';

  // Build pagination object if both page and limit are provided
  const pagination =
    page && limit
      ? {
          page: Number(page),
          limit: Number(limit)
        }
      : undefined;

  const result = await tabletService.findAllTablets(schoolId, filters, pagination);

  // Return response with proper structure
  if ('pagination' in result) {
    res.json(successResponse(result.data, result.pagination));
  } else {
    res.json(successResponse(result.data));
  }
}

/**
 * POST /tablets/pull-all-logs
 * Triggers an immediate pull from ALL active, online tablets for this school.
 * Used by the frontend "Sync Now" button on the device-logs page.
 */
export async function pullAllTabletLogs(req: Request, res: Response) {
  const schoolId = resolveSchoolId(req);

  // Find all active tablets for this school
  const tablets = await prisma.tablets.findMany({
    where: {
      school_id: schoolId,
      is_active: true,
      deleted_at: null
    },
    select: { id: true, name: true, status: true }
  });

  const results: Array<{
    tabletId: string;
    tabletName: string;
    status: string;
    saved?: number;
    duplicates?: number;
    errors?: string[];
  }> = [];

  for (const tablet of tablets) {
    try {
      // Health check first — skip tablets that are unreachable
      const health = await tabletService.checkHealth(tablet.id, schoolId).catch(() => null);
      if (!health?.healthy) {
        results.push({
          tabletId: tablet.id.toString(),
          tabletName: tablet.name,
          status: 'skipped',
          errors: ['Tablet unreachable']
        });
        continue;
      }

      const result = await tabletService.pullDeviceLogs(tablet.id, schoolId, 0);
      results.push({
        tabletId: tablet.id.toString(),
        tabletName: tablet.name,
        status: 'ok',
        saved: result.savedCount ?? 0,
        duplicates: result.duplicateCount ?? 0,
        errors: result.errors ?? []
      });
    } catch (err) {
      results.push({
        tabletId: tablet.id.toString(),
        tabletName: tablet.name,
        status: 'error',
        errors: [(err as Error).message]
      });
    }
  }

  const totalSaved = results.reduce((sum, r) => sum + (r.saved ?? 0), 0);
  const totalErrors = results.flatMap((r) => r.errors ?? []);

  res.json(
    successResponse({
      tablets: results,
      totalSaved,
      totalErrors: totalErrors.length,
      summary: `Pulled ${totalSaved} new logs from ${results.filter((r) => r.status === 'ok').length}/${tablets.length} tablets`
    })
  );
}
