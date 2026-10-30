/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Notification sending and logs
 *
 * /notifications/send:
 *   post:
 *     summary: Send notification
 *     tags: [Notifications]
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
 * /notifications/send-bulk:
 *   post:
 *     summary: Send bulk notifications
 *     tags: [Notifications]
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
 * /notifications/logs:
 *   get:
 *     summary: List notification logs
 *     tags: [Notifications]
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
 */
import { Router } from "express";
import * as logController from "../../controllers/notification/log.controller";
import * as sendController from "../../controllers/notification/send.controller";
import * as broadcastController from "../../controllers/notification/broadcast.controller";
import * as bulkSmsController from "../../controllers/notification/bulk-sms.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  sendBulkNotificationSchema,
  sendNotificationSchema
} from "../../validators/notification/send.validator";
import { listNotificationLogsSchema as listLogsSchema } from "../../validators/notification/log.validator";
import {
  parentBroadcastSchema,
  parentBroadcastPreviewSchema
} from "../../validators/notification/broadcast.validator";
import { notificationTemplateRoutes } from "./template.routes";

export const notificationRoutes = Router();

notificationRoutes.use("/templates", notificationTemplateRoutes);
notificationRoutes.use(verifyToken, requireSchoolAccess);

notificationRoutes.post(
  "/send",
  validate(sendNotificationSchema),
  asyncWrapper(sendController.sendNotification)
);

notificationRoutes.post(
  "/send-bulk",
  validate(sendBulkNotificationSchema),
  asyncWrapper(sendController.sendBulkNotifications)
);

// ── Bulk SMS — send to all / class / dormitory / single parent ──────────────
notificationRoutes.post(
  "/bulk-sms",
  asyncWrapper(bulkSmsController.sendBulkSms)
);
notificationRoutes.post(
  "/bulk-sms/preview",
  asyncWrapper(bulkSmsController.sendBulkSms)  // preview=true in body
);

notificationRoutes.get(
  "/logs",
  validate(listLogsSchema),
  asyncWrapper(logController.listNotificationLogs)
);

// ── Parent app broadcasts ───────────────────────────────────────────────────

notificationRoutes.post(
  "/parent-broadcasts/preview",
  validate({ body: parentBroadcastPreviewSchema }),
  asyncWrapper(broadcastController.previewParentBroadcast)
);

notificationRoutes.post(
  "/parent-broadcasts",
  validate({ body: parentBroadcastSchema }),
  asyncWrapper(broadcastController.sendParentBroadcast)
);
