/**
 * @swagger
 * tags:
 *   - name: Offline Sync
 *     description: Offline sync queue and status
 *
 * /offline-sync:
 *   post:
 *     summary: Queue offline records
 *     tags: [Offline Sync]
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
 * /offline-sync/status:
 *   get:
 *     summary: Get offline sync status
 *     tags: [Offline Sync]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
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
import * as offlineSyncController from "../controllers/offline-sync.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  getOfflineSyncStatusSchema,
  queueOfflineSyncSchema
} from "../validators/offline-sync.validator";

export const offlineSyncRoutes = Router();

offlineSyncRoutes.use(verifyToken, requireSchoolAccess);

offlineSyncRoutes.post(
  "/",
  validate(queueOfflineSyncSchema),
  asyncWrapper(offlineSyncController.queueOfflineRecords)
);

offlineSyncRoutes.get(
  "/status",
  validate(getOfflineSyncStatusSchema),
  asyncWrapper(offlineSyncController.getOfflineSyncStatus)
);
