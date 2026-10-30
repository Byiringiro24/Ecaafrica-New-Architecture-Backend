// Adapted from migration/Attendance_device_config_backend/src/routes/tablets.js

import { Router } from 'express';
import * as tabletController from '../controllers/tablet.controller';
import { asyncWrapper } from '../helpers/asyncWrapper';
import { verifyToken } from '../middleware/auth';
import { requireSchoolAccess } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  createTabletSchema,
  updateTabletSchema,
  tabletIdParamSchema,
  listTabletsSchema,
  updateTabletStatusSchema,
} from '../validators/tablet.validator';

export const tabletRoutes = Router();

// All tablet routes require authentication and school access
tabletRoutes.use(verifyToken, requireSchoolAccess);

// List tablets with pagination and filters
tabletRoutes.get(
  '/',
  validate(listTabletsSchema),
  asyncWrapper(tabletController.getAllTablets)
);

// Device logs feature endpoint - list tablets for device health monitoring
tabletRoutes.get(
  '/device-logs/list',
  asyncWrapper(tabletController.listTabletsForDeviceLogs)
);

// Pull logs from ALL active tablets for this school (used by frontend "Sync Now")
tabletRoutes.post(
  '/pull-all-logs',
  asyncWrapper(tabletController.pullAllTabletLogs)
);

tabletRoutes.get(
  '/:id/device/status',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.getTabletDeviceStatus)
);

tabletRoutes.post(
  '/:id/device/connect',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.connectTabletDevice)
);

tabletRoutes.post(
  '/:id/device/disconnect',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.disconnectTabletDevice)
);

tabletRoutes.post(
  '/:id/device/sync-time',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.syncTabletDeviceTime)
);

tabletRoutes.post(
  '/:id/device/set-time',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.setTabletDeviceTime)
);

tabletRoutes.get(
  '/:id/device/users',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.pullTabletDeviceUsers)
);

tabletRoutes.post(
  '/:id/device/users',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.addTabletDeviceUser)
);

tabletRoutes.delete(
  '/:id/device/users/:userId',
  asyncWrapper(tabletController.deleteTabletDeviceUser)
);

tabletRoutes.post(
  '/:id/device/pull-logs',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.pullTabletDeviceLogs)
);

tabletRoutes.post(
  '/:id/device/push-students',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.pushTabletDeviceStudents)
);

tabletRoutes.post(
  '/:id/device/clear-logs',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.clearTabletDeviceLogs)
);

tabletRoutes.post(
  '/:id/device/clear-all',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.clearTabletDeviceData)
);

tabletRoutes.post(
  '/:id/device/poweroff',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.powerOffTabletDevice)
);

// Get single tablet
tabletRoutes.get(
  '/:id',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.getTablet)
);

// Register new tablet - ONLY system admin (platform owner)
tabletRoutes.post(
  '/',
  validate(createTabletSchema),
  asyncWrapper(tabletController.registerTablet)
);

// Update tablet
tabletRoutes.patch(
  '/:id',
  validate(updateTabletSchema),
  asyncWrapper(tabletController.updateTablet)
);

tabletRoutes.put(
  '/:id',
  validate(updateTabletSchema),
  asyncWrapper(tabletController.updateTablet)
);

// Delete tablet (soft delete)
tabletRoutes.delete(
  '/:id',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.deleteTablet)
);

// Check tablet health
tabletRoutes.post(
  '/:id/health-check',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.checkTabletHealth)
);

tabletRoutes.get(
  '/:id/health',
  validate({ params: tabletIdParamSchema }),
  asyncWrapper(tabletController.checkTabletHealth)
);

// Update tablet status
tabletRoutes.patch(
  '/:id/status',
  validate(updateTabletStatusSchema),
  asyncWrapper(tabletController.updateTabletStatus)
);
