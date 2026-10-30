import { Router } from "express";
import * as attController from "../../controllers/boarding/boarding-attendance.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireBoardingRole } from "../../middleware/roleGuard";

export const boardingAttendanceRoutes = Router();
boardingAttendanceRoutes.use(verifyToken, requireSchoolAccess);

// Config (DOD / school admin only)
boardingAttendanceRoutes.get("/config", asyncWrapper(attController.getConfig));
boardingAttendanceRoutes.patch("/config", requireBoardingRole, asyncWrapper(attController.updateConfig));

// Attendance windows
boardingAttendanceRoutes.get("/windows", asyncWrapper(attController.listWindows));
boardingAttendanceRoutes.post("/windows", requireBoardingRole, asyncWrapper(attController.createWindow));
boardingAttendanceRoutes.patch("/windows/:id", requireBoardingRole, asyncWrapper(attController.updateWindow));
boardingAttendanceRoutes.delete("/windows/:id", requireBoardingRole, asyncWrapper(attController.deleteWindow));

// Sessions
boardingAttendanceRoutes.get("/sessions", asyncWrapper(attController.listSessions));
boardingAttendanceRoutes.post("/sessions", requireBoardingRole, asyncWrapper(attController.openSession));
boardingAttendanceRoutes.get("/sessions/:id", asyncWrapper(attController.getSessionSummary));
boardingAttendanceRoutes.post("/sessions/:id/reconcile", requireBoardingRole, asyncWrapper(attController.reconcileSession));
boardingAttendanceRoutes.patch("/sessions/:id/correct", requireBoardingRole, asyncWrapper(attController.correctAttendance));
