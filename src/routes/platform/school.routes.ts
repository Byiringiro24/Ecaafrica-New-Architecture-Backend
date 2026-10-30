/**
 * @swagger
 * tags:
 *   - name: Platform Schools
 *     description: Platform school management
 *
 * /platform/schools:
 *   get:
 *     summary: List schools
 *     tags: [Platform Schools]
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
 *     summary: Create school
 *     tags: [Platform Schools]
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
 * /platform/schools/{id}:
 *   get:
 *     summary: Get school by id
 *     tags: [Platform Schools]
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
 *     summary: Update school
 *     tags: [Platform Schools]
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
 *   delete:
 *     summary: Delete school
 *     tags: [Platform Schools]
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
import * as schoolController from "../../controllers/platform/school.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyPlatformToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { PlatformRole } from "../../constants/roles";
import {
  createSchoolSchema,
  listSchoolsSchema,
  listSchoolAuditLogsSchema,
  listSchoolBillingSchema,
  listSchoolUsersSchema,
  schoolIdParamSchema,
  updateSchoolSchema
} from "../../validators/platform/school.validator";

export const schoolRoutes = Router();

schoolRoutes.use(verifyPlatformToken, requireRole(PlatformRole.PLATFORM_ADMIN));

schoolRoutes.get("/", validate(listSchoolsSchema), asyncWrapper(schoolController.listSchools));

schoolRoutes.post("/", validate(createSchoolSchema), asyncWrapper(schoolController.createSchool));

schoolRoutes.get(
  "/:id",
  validate({ params: schoolIdParamSchema }),
  asyncWrapper(schoolController.getSchool)
);

schoolRoutes.get(
  "/:id/overview",
  validate({ params: schoolIdParamSchema }),
  asyncWrapper(schoolController.getSchoolOverview)
);

schoolRoutes.get(
  "/:id/billing",
  validate(listSchoolBillingSchema),
  asyncWrapper(schoolController.getSchoolBilling)
);

schoolRoutes.get(
  "/:id/users",
  validate(listSchoolUsersSchema),
  asyncWrapper(schoolController.listSchoolUsers)
);

schoolRoutes.get(
  "/:id/audit-logs",
  validate(listSchoolAuditLogsSchema),
  asyncWrapper(schoolController.listSchoolAuditLogs)
);

schoolRoutes.patch("/:id", validate(updateSchoolSchema), asyncWrapper(schoolController.updateSchool));

schoolRoutes.delete(
  "/:id",
  validate({ params: schoolIdParamSchema }),
  asyncWrapper(schoolController.deleteSchool)
);
