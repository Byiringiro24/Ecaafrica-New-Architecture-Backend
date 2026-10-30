/**
 * @swagger
 * tags:
 *   - name: Staff
 *     description: Staff module routes
 */
import { Router } from "express";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess } from "../../middleware/roleGuard";
import { staffLeaveBalanceRoutes } from "./leave-balance.routes";
import { staffProfileRoutes } from "./profile.routes";
import * as userController from "../../controllers/user.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import { listUsersSchema } from "../../validators/user.validator";

export const staffRoutes = Router();

staffRoutes.use(verifyToken, requireSchoolAccess);

// GET /api/v1/staff - list staff users (alias for users with staff roles)
staffRoutes.get("/", validate(listUsersSchema), asyncWrapper(userController.listUsers));

// TODO: /api/v1/staff/leave-requests — blocked until staff_leave_requests table is approved
// TODO: /api/v1/staff/attendance — blocked until staff_attendance table is approved

staffRoutes.use("/profiles", staffProfileRoutes);
staffRoutes.use("/leave-balances", staffLeaveBalanceRoutes);
