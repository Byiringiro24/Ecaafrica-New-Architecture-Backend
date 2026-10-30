import { Router } from "express";
import * as patronController from "../../controllers/boarding/patron.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireRole } from "../../middleware/roleGuard";

export const patronRoutes = Router();
patronRoutes.use(verifyToken, requireSchoolAccess);

// GET /boarding/patrons/me/devices — devices in the patron's assigned dormitories
patronRoutes.get("/me/devices", asyncWrapper(patronController.listMyDevices));

// GET /boarding/patrons/:userId/assignments — list dorms assigned to a user
patronRoutes.get("/:userId/assignments", asyncWrapper(patronController.listPatronAssignments));

// GET /boarding/patrons/dormitory/:dormitoryId — list patrons for a dorm
patronRoutes.get("/dormitory/:dormitoryId", asyncWrapper(patronController.listDormitoryPatrons));

// POST /boarding/patrons/:userId/assignments — assign dorms to a user (school_admin or boarding officer only)
patronRoutes.post("/:userId/assignments", requireRole("school_admin", "director_of_discipline"), asyncWrapper(patronController.assignPatronToDormitories));

// DELETE /boarding/patrons/:userId/dormitory/:dormitoryId — remove from dorm
patronRoutes.delete("/:userId/dormitory/:dormitoryId", requireRole("school_admin", "director_of_discipline"), asyncWrapper(patronController.removePatronFromDormitory));
