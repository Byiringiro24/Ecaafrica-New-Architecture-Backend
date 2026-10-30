import { Router } from "express";
import * as controller from "../../controllers/boarding/supervisor.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireRole, requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  createBoardingSupervisorSchema,
  replaceSupervisorDormitoriesSchema,
} from "../../validators/boarding/supervisor.validator";

export const boardingSupervisorRoutes = Router();
boardingSupervisorRoutes.use(verifyToken, requireSchoolAccess);
boardingSupervisorRoutes.get(
  "/",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  asyncWrapper(controller.listBoardingSupervisors),
);
boardingSupervisorRoutes.post(
  "/",
  requireRole("school_admin", "director_of_discipline"),
  validate(createBoardingSupervisorSchema),
  asyncWrapper(controller.createBoardingSupervisor),
);
boardingSupervisorRoutes.patch(
  "/:id/dormitories",
  requireRole("school_admin", "director_of_discipline"),
  validate(replaceSupervisorDormitoriesSchema),
  asyncWrapper(controller.replaceSupervisorDormitories),
);
