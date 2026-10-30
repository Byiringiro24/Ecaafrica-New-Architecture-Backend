/**
 * @swagger
 * tags:
 *   - name: Staff Profiles
 *     description: Staff profile management
 *
 * /staff/profiles:
 *   get:
 *     summary: List staff profiles
 *     tags: [Staff Profiles]
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
 *     summary: Create staff profile
 *     tags: [Staff Profiles]
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
 * /staff/profiles/{id}:
 *   get:
 *     summary: Get staff profile by id
 *     tags: [Staff Profiles]
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
 *     summary: Update staff profile
 *     tags: [Staff Profiles]
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
 *     summary: Delete staff profile
 *     tags: [Staff Profiles]
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
import * as profileController from "../../controllers/staff/profile.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  createStaffProfileSchema,
  listStaffProfilesSchema,
  staffProfileIdParamSchema,
  updateStaffProfileSchema
} from "../../validators/staff/profile.validator";

export const staffProfileRoutes = Router();

staffProfileRoutes.get(
  "/",
  validate(listStaffProfilesSchema),
  asyncWrapper(profileController.listStaffProfiles)
);

staffProfileRoutes.post(
  "/",
  validate(createStaffProfileSchema),
  asyncWrapper(profileController.createStaffProfile)
);

staffProfileRoutes.get(
  "/me",
  asyncWrapper(profileController.getMyStaffProfile)
);

staffProfileRoutes.get(
  "/:id",
  validate({ params: staffProfileIdParamSchema }),
  asyncWrapper(profileController.getStaffProfile)
);

staffProfileRoutes.patch(
  "/:id",
  validate(updateStaffProfileSchema),
  asyncWrapper(profileController.updateStaffProfile)
);

staffProfileRoutes.delete(
  "/:id",
  validate({ params: staffProfileIdParamSchema }),
  asyncWrapper(profileController.deleteStaffProfile)
);
