import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as diningService from "../../services/boarding/dining.service";
import * as assignmentService from "../../services/boarding/dining-assignment.service";
import { hasEffectiveRole } from "../../middleware/roleGuard";

const schoolId = (req: Request) => {
  const id = req.user?.school_id;
  if (!id) throw new AppError("forbidden", "Missing school context", 403);
  return id;
};

const canManageAllDining = (req: Request) =>
  hasEffectiveRole(req, "school_admin", "director_of_discipline", "patron", "matron");

// Menus
export const listMenus = async (req: Request, res: Response) => {
  const data = await diningService.listDiningMenus(schoolId(req));
  res.json(successResponse(data));
};

export const createMenu = async (req: Request, res: Response) => {
  const data = await diningService.createDiningMenu(schoolId(req), {
    ...req.body,
    created_by: req.user?.id,
  });
  res.status(201).json(successResponse(data));
};

export const addMenuItems = async (req: Request, res: Response) => {
  const data = await diningService.addMenuItems(schoolId(req), req.params.menuId, req.body.items);
  res.status(201).json(successResponse(data));
};

// Schedules
export const listSchedules = async (req: Request, res: Response) => {
  const data = await diningService.listDiningSchedules(schoolId(req), req.query.dormitory_id as string);
  res.json(successResponse(data));
};

export const createSchedule = async (req: Request, res: Response) => {
  const data = await diningService.createDiningSchedule(schoolId(req), {
    ...req.body,
    created_by: req.user?.id,
  });
  res.status(201).json(successResponse(data));
};

// Sessions & Attendance
export const listSessions = async (req: Request, res: Response) => {
  if (!canManageAllDining(req)) {
    const assignments = await assignmentService.listAssignments(schoolId(req), String(req.user!.id), req.query.session_date as string | undefined);
    const groups = new Set(assignments.map((a) => a.gender_group));
    if (!groups.size) return res.json(successResponse([]));
    if (!req.query.gender_group || !groups.has(String(req.query.gender_group))) req.query.gender_group = [...groups][0];
  }
  const data = await diningService.listDiningSessions(schoolId(req), {
    dormitory_id: req.query.dormitory_id as string | undefined,
    class_id: req.query.class_id as string | undefined,
    meal_type: req.query.meal_type as any,
    gender_group: req.query.gender_group as string | undefined,
    session_date: req.query.session_date as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : 50,
  });
  res.json(successResponse(data));
};

export const getSession = async (req: Request, res: Response) => {
  const data: any = await diningService.getDiningSession(schoolId(req), req.params.sessionId);
  if (!canManageAllDining(req) && (!data.gender_group || !(await assignmentService.isAssigned(schoolId(req), req.user!.id, data.gender_group, new Date(data.session_date))))) throw new AppError("forbidden", "You are not assigned to this dining group", 403);
  res.json(successResponse(data));
};

export const openSession = async (req: Request, res: Response) => {
  const { dormitory_id, class_id, gender_group, meal_type, session_date, schedule_id } = req.body;
  if (!canManageAllDining(req)) {
    if (!gender_group || !(await assignmentService.isAssigned(schoolId(req), req.user!.id, gender_group, new Date(session_date)))) throw new AppError("forbidden", "You are not assigned to this dining group for this date", 403);
  }
  const data = await diningService.openDiningSession(
    schoolId(req), dormitory_id, meal_type, new Date(session_date), req.user!.id, schedule_id, gender_group, class_id
  );
  res.status(201).json(successResponse(data));
};

export const getSessionRoster = async (req: Request, res: Response) => {
  if (!canManageAllDining(req)) {
    const data: any = await diningService.getDiningSession(schoolId(req), req.params.sessionId);
    if (!data.gender_group || !(await assignmentService.isAssigned(schoolId(req), req.user!.id, data.gender_group, new Date(data.session_date)))) throw new AppError("forbidden", "You are not assigned to this dining group", 403);
  }
  const data = await diningService.getDiningSessionRoster(schoolId(req), req.params.sessionId);
  res.json(successResponse(data));
};

export const markAttendance = async (req: Request, res: Response) => {
  if (!canManageAllDining(req)) {
    const session: any = await diningService.getDiningSession(schoolId(req), req.params.sessionId);
    if (!session.gender_group || !(await assignmentService.isAssigned(schoolId(req), req.user!.id, session.gender_group, new Date(session.session_date)))) throw new AppError("forbidden", "You are not assigned to this dining group", 403);
  }
  const data = await diningService.markDiningAttendance(
    schoolId(req), req.params.sessionId, req.body.marks, req.user!.id
  );
  res.json(successResponse(data));
};

export const closeSession = async (req: Request, res: Response) => {
  if (!canManageAllDining(req)) {
    const session: any = await diningService.getDiningSession(schoolId(req), req.params.sessionId);
    if (!session.gender_group || !(await assignmentService.isAssigned(schoolId(req), req.user!.id, session.gender_group, new Date(session.session_date)))) throw new AppError("forbidden", "You are not assigned to this dining group", 403);
  }
  const data = await diningService.closeDiningSession(schoolId(req), req.params.sessionId, req.user!.id);
  res.json(successResponse(data));
};
