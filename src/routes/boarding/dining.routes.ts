import { Router } from "express";
import * as diningController from "../../controllers/boarding/dining.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireBoardingRole, requireRole, hasEffectiveRole } from "../../middleware/roleGuard";
import * as assignmentController from "../../controllers/boarding/dining-assignment.controller";
import * as assignmentService from "../../services/boarding/dining-assignment.service";
import * as diningService from "../../services/boarding/dining.service";
import { errorResponse } from "../../helpers/response";

export const diningRoutes = Router();
diningRoutes.use(verifyToken, requireSchoolAccess);

// Assigned staff may submit only the dining session they were assigned to cover.
// Boarding roles retain access to close any session.
const requireDiningAttendanceAccess = async (req: any, res: any, next: any) => {
  if (hasEffectiveRole(req, "school_admin", "director_of_discipline", "patron", "matron")) {
    next();
    return;
  }

  const session: any = await diningService.getDiningSession(req.user.school_id, req.params.sessionId);
  const assigned = session?.gender_group && await assignmentService.isAssigned(
    req.user.school_id,
    req.user.id,
    session.gender_group,
    new Date(session.session_date),
  );
  if (assigned) {
    next();
    return;
  }

  res.status(403).json(errorResponse("forbidden", "You are not assigned to this dining session"));
};

// School administrators assign the weekly dining duty; teachers only see their own assignments.
diningRoutes.get("/assignments", asyncWrapper(assignmentController.list));
diningRoutes.post("/assignments", requireRole("school_admin"), asyncWrapper(assignmentController.create));
diningRoutes.delete("/assignments/:id", requireRole("school_admin"), asyncWrapper(assignmentController.remove));

// Menus
diningRoutes.get("/menus", asyncWrapper(diningController.listMenus));
diningRoutes.post("/menus", requireBoardingRole, asyncWrapper(diningController.createMenu));
diningRoutes.post("/menus/:menuId/items", requireBoardingRole, asyncWrapper(diningController.addMenuItems));

// Schedules
diningRoutes.get("/schedules", asyncWrapper(diningController.listSchedules));
diningRoutes.post("/schedules", requireBoardingRole, asyncWrapper(diningController.createSchedule));

// Sessions & attendance
diningRoutes.get("/sessions", asyncWrapper(diningController.listSessions));
diningRoutes.post("/sessions", asyncWrapper(diningController.openSession));
diningRoutes.get("/sessions/:sessionId", asyncWrapper(diningController.getSession));
diningRoutes.get("/sessions/:sessionId/roster", asyncWrapper(diningController.getSessionRoster));
diningRoutes.post("/sessions/:sessionId/attendance", asyncWrapper(diningController.markAttendance));
diningRoutes.post("/sessions/:sessionId/close", asyncWrapper(requireDiningAttendanceAccess), asyncWrapper(diningController.closeSession));
