/**
 * @swagger
 * tags:
 *   - name: Devices
 *     description: Device management
 *
 * /devices:
 *   get:
 *     summary: List devices
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *   post:
 *     summary: Register device
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /devices/{id}:
 *   get:
 *     summary: Get device by id
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *   patch:
 *     summary: Update device
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /devices/{id}/deactivate:
 *   patch:
 *     summary: Deactivate device
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /devices/{id}/delete:
 *   delete:
 *     summary: Delete device
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
import { Router } from "express";
import * as deviceController from "../controllers/device.controller";
import * as deviceAssignmentController from "../controllers/device-assignment.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess, requireSystemAdmin } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createDeviceSchema,
  deviceIdParamSchema,
  deviceSessionParamSchema,
  listDevicesSchema,
  recordDeviceAttendanceEventSchema,
  saveDeviceAttendanceConfigSchema,
  updateDeviceSchema,
  createDeviceSessionSchema,
  updateDeviceSessionSchema,
  deleteDeviceSessionSchema,
} from "../validators/device.validator";

export const deviceRoutes = Router();

deviceRoutes.use(verifyToken, requireSchoolAccess);

deviceRoutes.get(
  "/",
  validate(listDevicesSchema),
  asyncWrapper(deviceController.listDevices)
);

deviceRoutes.post(
  "/",
  validate(createDeviceSchema),
  requireSystemAdmin, // Only system admin can register devices
  asyncWrapper(deviceController.registerDevice)
);

// Device logs feature endpoint - list all device statuses
deviceRoutes.get(
  "/status",
  asyncWrapper(deviceController.listDeviceStatuses)
);

// Static routes must be registered before /:id, otherwise "locations" is
// treated as a device id and rejected by deviceIdParamSchema.
deviceRoutes.get(
  "/locations",
  asyncWrapper(deviceAssignmentController.listDevicesWithLocation)
);

deviceRoutes.get(
  "/:id",
  validate({ params: deviceIdParamSchema }),
  asyncWrapper(deviceController.getDevice)
);

deviceRoutes.patch(
  "/:id",
  validate(updateDeviceSchema),
  requireSystemAdmin, // Only system admin can update devices
  asyncWrapper(deviceController.updateDevice)
);

deviceRoutes.patch(
  "/:id/deactivate",
  validate({ params: deviceIdParamSchema }),
  requireSystemAdmin, // Only system admin can deactivate devices
  asyncWrapper(deviceController.deactivateDevice)
);

deviceRoutes.delete(
  "/:id",
  validate({ params: deviceIdParamSchema }),
  requireSystemAdmin, // Only system admin can delete devices
  asyncWrapper(deviceController.deleteDevice)
);

deviceRoutes.get(
  "/:id/status",
  validate({ params: deviceIdParamSchema }),
  asyncWrapper(deviceController.getDeviceStatus)
);

deviceRoutes.post(
  "/:id/push-students",
  validate({ params: deviceIdParamSchema }),
  asyncWrapper(deviceController.pushStudentsToDevice)
);

// DELETE students from device (removes fingerprints from FK623)
// Body: { mode: "selected"|"class"|"all", student_ids?, class_id? }
deviceRoutes.post(
  "/:id/remove-students",
  validate({ params: deviceIdParamSchema }),
  asyncWrapper(deviceController.removeStudentsFromDevice)
);

deviceRoutes.get(
  "/:id/attendance-config",
  validate({ params: deviceIdParamSchema }),
  asyncWrapper(deviceController.getDeviceAttendanceConfig)
);

deviceRoutes.post(
  "/:id/attendance-config",
  validate(saveDeviceAttendanceConfigSchema),
  asyncWrapper(deviceController.saveDeviceAttendanceConfig)
);

deviceRoutes.post(
  "/:id/attendance-events",
  validate(recordDeviceAttendanceEventSchema),
  asyncWrapper(deviceController.recordDeviceAttendanceEvent)
);

deviceRoutes.get(
  "/:id/logs",
  validate({ params: deviceIdParamSchema }),
  asyncWrapper(deviceController.listDeviceLogs)
);

deviceRoutes.post(
  "/:id/logs",
  validate({ params: deviceIdParamSchema }),
  asyncWrapper(deviceController.createDeviceLog)
);

// Device Session Management Routes
deviceRoutes.get(
  "/:id/sessions",
  validate({ params: deviceIdParamSchema }),
  asyncWrapper(deviceController.getDeviceSessions)
);

deviceRoutes.post(
  "/:id/sessions",
  validate(createDeviceSessionSchema),
  asyncWrapper(deviceController.createDeviceSession)
);

deviceRoutes.put(
  "/:id/sessions/:sessionId",
  validate(updateDeviceSessionSchema),
  asyncWrapper(deviceController.updateDeviceSession)
);

deviceRoutes.delete(
  "/:id/sessions/:sessionId",
  validate(deleteDeviceSessionSchema),
  asyncWrapper(deviceController.deleteDeviceSession)
);

// Activate / deactivate a session — only one active at a time per device
deviceRoutes.patch(
  "/:id/sessions/:sessionId/activate",
  validate({ params: deviceSessionParamSchema }),
  asyncWrapper(deviceController.activateDeviceSession)
);

deviceRoutes.patch(
  "/:id/sessions/:sessionId/deactivate",
  validate({ params: deviceSessionParamSchema }),
  asyncWrapper(deviceController.deactivateDeviceSession)
);

deviceRoutes.patch(
  "/:id/assign-location",
  asyncWrapper(deviceAssignmentController.assignDeviceLocation)
);

// GET students assigned to this device, grouped by 2000 cap
deviceRoutes.get(
  "/:id/assigned-students",
  asyncWrapper(deviceAssignmentController.getAssignedStudents)
);

// POST push a specific group to the tablet
deviceRoutes.post(
  "/:id/push-group",
  asyncWrapper(deviceAssignmentController.pushStudentGroup)
);

// Mark Absent Route
deviceRoutes.post(
  "/:id/sessions/:sessionId/mark-absent",
  validate(deleteDeviceSessionSchema),
  asyncWrapper(deviceController.markStudentsAbsent)
);
