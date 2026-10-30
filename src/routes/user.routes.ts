/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: School user management
 *
 * /users:
 *   get:
 *     summary: List users
 *     tags: [Users]
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
 *     summary: Create user
 *     tags: [Users]
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
 * /users/{id}:
 *   get:
 *     summary: Get user by id
 *     tags: [Users]
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
 *     summary: Update user
 *     tags: [Users]
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
 *     summary: Delete user
 *     tags: [Users]
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
 * /users/{id}/roles:
 *   post:
 *     summary: Assign role to user
 *     tags: [Users]
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
 * /users/{id}/roles/{roleId}:
 *   delete:
 *     summary: Remove role from user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: roleId
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
import * as userController from "../controllers/user.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess, requireRole } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  assignRoleSchema,
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userIdParamSchema,
  userRoleParamsSchema
} from "../validators/user.validator";

export const userRoutes = Router();

userRoutes.use(verifyToken, requireSchoolAccess, requireRole("school_admin", "director_of_discipline", "director_of_studies"));

const canViewStaff = requireRole("school_admin", "director_of_discipline", "director_of_studies");
const canManageUsers = requireRole("school_admin", "director_of_discipline");

userRoutes.get("/", canViewStaff, validate(listUsersSchema), asyncWrapper(userController.listUsers));

userRoutes.post("/", canManageUsers, validate(createUserSchema), asyncWrapper(userController.createUser));

userRoutes.get(
  "/:id",
  canViewStaff,
  validate({ params: userIdParamSchema }),
  asyncWrapper(userController.getUser)
);

userRoutes.patch(
  "/:id",
  canManageUsers,
  validate(updateUserSchema),
  asyncWrapper(userController.updateUser)
);

userRoutes.post(
  "/:id/reset-password",
  requireRole("school_admin"),
  validate({ params: userIdParamSchema }),
  asyncWrapper(userController.resetStaffPassword),
);

userRoutes.delete(
  "/:id",
  canManageUsers,
  validate({ params: userIdParamSchema }),
  asyncWrapper(userController.deleteUser)
);

userRoutes.post(
  "/:id/roles",
  canManageUsers,
  validate(assignRoleSchema),
  asyncWrapper(userController.assignRole)
);

userRoutes.delete(
  "/:id/roles/:roleId",
  canManageUsers,
  validate({ params: userRoleParamsSchema }),
  asyncWrapper(userController.removeRole)
);
