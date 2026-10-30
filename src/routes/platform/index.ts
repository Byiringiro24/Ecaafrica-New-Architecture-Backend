/**
 * @swagger
 * tags:
 *   - name: Platform Revenue
 *     description: Platform revenue reporting
 *
 * /platform/revenue:
 *   get:
 *     summary: Get revenue summary
 *     tags: [Platform Revenue]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
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
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyPlatformToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/roleGuard";
import { PlatformRole } from "../../constants/roles";
import * as invoiceController from "../../controllers/platform/invoice.controller";
import { announcementRoutes } from "./announcement.routes";
import { invoiceRoutes } from "./invoice.routes";
import { planRoutes } from "./plan.routes";
import { platformUserRoutes } from "./platform-user.routes";
import { schoolRoutes } from "./school.routes";
import { subscriptionRoutes } from "./subscription.routes";
import { supportTicketRoutes } from "./support-ticket.routes";
import { smsProviderRoutes } from "./sms-provider.routes";
import { hardwareRoutes } from "./hardware.routes";
import * as overviewController from "../../controllers/platform/overview.controller";
import * as smsUsageController from "../../controllers/platform/sms-usage.controller";
import { validate } from "../../middleware/validate";
import { smsUsageQuerySchema } from "../../validators/platform/sms-usage.validator";

export const platformRoutes = Router();

platformRoutes.get(
  "/revenue",
  verifyPlatformToken,
  requireRole(PlatformRole.PLATFORM_ADMIN),
  asyncWrapper(invoiceController.getRevenueSummary)
);

platformRoutes.get(
  "/overview",
  verifyPlatformToken,
  requireRole(PlatformRole.PLATFORM_ADMIN),
  asyncWrapper(overviewController.getPlatformOverview)
);

platformRoutes.get(
  "/sms-usage",
  verifyPlatformToken,
  requireRole(PlatformRole.PLATFORM_ADMIN),
  validate(smsUsageQuerySchema),
  asyncWrapper(smsUsageController.getSmsUsage)
);

platformRoutes.use("/schools", schoolRoutes);
platformRoutes.use("/hardware", hardwareRoutes);
platformRoutes.use("/plans", planRoutes);
platformRoutes.use("/subscriptions", subscriptionRoutes);
platformRoutes.use("/invoices", invoiceRoutes);
platformRoutes.use("/users", platformUserRoutes);
platformRoutes.use("/announcements", announcementRoutes);
platformRoutes.use("/support-tickets", supportTicketRoutes);
platformRoutes.use("/sms-providers", smsProviderRoutes);
