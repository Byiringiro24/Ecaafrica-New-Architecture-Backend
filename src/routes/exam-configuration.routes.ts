import { Router } from "express";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { requireRole, requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { verifyToken } from "../middleware/auth";
import * as controller from "../controllers/exam-configuration.controller";
import {
  createExamTypeSchema, updateExamTypeSchema,
  createGradingRoleSchema, updateGradingRoleSchema
} from "../validators/exam-configuration.validator";

export const examConfigurationRoutes = Router();
examConfigurationRoutes.use(verifyToken, requireSchoolAccess);

examConfigurationRoutes.get("/exam-types", requireRole("teacher", "school_admin", "director_of_studies"), asyncWrapper(controller.listExamTypes));
examConfigurationRoutes.post("/exam-types", requireRole("school_admin", "director_of_studies"), validate(createExamTypeSchema), asyncWrapper(controller.createExamType));
examConfigurationRoutes.patch("/exam-types/:id", requireRole("school_admin", "director_of_studies"), validate(updateExamTypeSchema), asyncWrapper(controller.updateExamType));

examConfigurationRoutes.get("/grading-roles", requireRole("teacher", "school_admin", "director_of_studies"), asyncWrapper(controller.listGradingRoles));
examConfigurationRoutes.post("/grading-roles", requireRole("school_admin", "director_of_studies"), validate(createGradingRoleSchema), asyncWrapper(controller.createGradingRole));
examConfigurationRoutes.patch("/grading-roles/:id", requireRole("school_admin", "director_of_studies"), validate(updateGradingRoleSchema), asyncWrapper(controller.updateGradingRole));
