import { Router } from "express";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { requireRole, requireSchoolAccess } from "../middleware/roleGuard";
import { verifyToken } from "../middleware/auth";
import { validate } from "../middleware/validate";
import * as controller from "../controllers/exam-modification-request.controller";
import { createModificationRequestSchema, reviewModificationRequestSchema } from "../validators/exam-modification-request.validator";

export const examModificationRequestRoutes = Router();
examModificationRequestRoutes.use(verifyToken, requireSchoolAccess);
examModificationRequestRoutes.post("/exams/:examId", requireRole("teacher"), validate(createModificationRequestSchema), asyncWrapper(controller.create));
examModificationRequestRoutes.get("/", requireRole("teacher", "school_admin", "director_of_studies"), asyncWrapper(controller.list));
examModificationRequestRoutes.patch("/:id", requireRole("school_admin", "director_of_studies"), validate(reviewModificationRequestSchema), asyncWrapper(controller.review));
