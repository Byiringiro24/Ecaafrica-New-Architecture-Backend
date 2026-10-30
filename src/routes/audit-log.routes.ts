/**
 * @swagger
 * tags:
 *   - name: Audit Logs
 *     description: Audit log entries
 *
 * /audit-logs:
 *   get:
 *     summary: List audit logs
 *     tags: [Audit Logs]
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
import * as auditLogController from "../controllers/audit-log.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { listAuditLogsSchema } from "../validators/audit-log.validator";

export const auditLogRoutes = Router();

auditLogRoutes.use(verifyToken, requireSchoolAccess);

auditLogRoutes.get(
  "/",
  validate(listAuditLogsSchema),
  asyncWrapper(auditLogController.listAuditLogs)
);
