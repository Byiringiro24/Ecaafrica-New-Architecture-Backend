import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as attService from "../../services/boarding/boarding-attendance.service";

const schoolId = (req: Request) => {
  const id = req.user?.school_id;
  if (!id) throw new AppError("forbidden", "Missing school context", 403);
  return id;
};

// Windows
export const listWindows = async (req: Request, res: Response) => {
  const data = await attService.listAttendanceWindows(schoolId(req), req.query.dormitory_id as string);
  res.json(successResponse(data));
};

export const createWindow = async (req: Request, res: Response) => {
  const data = await attService.createAttendanceWindow(schoolId(req), {
    ...req.body,
    created_by: req.user?.id,
  });
  res.status(201).json(successResponse(data));
};

export const updateWindow = async (req: Request, res: Response) => {
  const data = await attService.updateAttendanceWindow(schoolId(req), req.params.id, req.body);
  res.json(successResponse(data));
};

export const deleteWindow = async (req: Request, res: Response) => {
  const data = await attService.deleteAttendanceWindow(schoolId(req), req.params.id);
  res.json(successResponse(data));
};

// Sessions
export const openSession = async (req: Request, res: Response) => {
  const { dormitory_id, session_date, window_id, session_name, location_type } = req.body;
  const data = await attService.openBoardingAttendanceSession(
    schoolId(req), dormitory_id, new Date(session_date), window_id,
    session_name, location_type, req.user?.id
  );
  res.status(201).json(successResponse(data));
};

export const listSessions = async (req: Request, res: Response) => {
  const filters = {
    dormitory_id:  req.query.dormitory_id as string | undefined,
    location_type: req.query.location_type as string | undefined,
    session_date:  req.query.session_date  as string | undefined,
    // Patron/matron see only their own sessions unless they are admin/DOD
    created_by: ["patron", "matron"].includes(req.user?.role ?? "")
      ? req.user?.id
      : (req.query.created_by as string | undefined),
    limit: req.query.limit ? Number(req.query.limit) : 50,
  };
  const data = await attService.listBoardingSessions(schoolId(req), filters);
  res.json(successResponse(data));
};

export const getSessionSummary = async (req: Request, res: Response) => {
  const data = await attService.getBoardingAttendanceSummary(schoolId(req), req.params.id);
  res.json(successResponse(data));
};

export const reconcileSession = async (req: Request, res: Response) => {
  const data = await attService.reconcileBoardingAttendance(req.params.id);
  res.json(successResponse(data));
};

export const correctAttendance = async (req: Request, res: Response) => {
  const { student_id, status, reason } = req.body;
  const data = await attService.manuallyCorrectAttendance(
    schoolId(req), req.params.id, student_id, status, reason, req.user!.id
  );
  res.json(successResponse(data));
};

// Config
export const getConfig = async (req: Request, res: Response) => {
  const data = await attService.getBoardingConfig(schoolId(req));
  res.json(successResponse(data));
};

export const updateConfig = async (req: Request, res: Response) => {
  const data = await attService.updateBoardingConfig(schoolId(req), req.body);
  res.json(successResponse(data));
};
