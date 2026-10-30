import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as appService from "../services/app.service";

export const sendOtp = async (req: Request, res: Response) => {
  const result = await appService.sendOtp(req.body.phone);
  res.json(successResponse(result));
};

export const verifyOtp = async (req: Request, res: Response) => {
  const result = await appService.verifyOtp(req.body.phone, req.body.otp);
  res.json(successResponse(result));
};

export const refresh = async (req: Request, res: Response) => {
  const result = await appService.refreshTokens(req.body.refreshToken);
  res.json(successResponse(result));
};

export const getProfile = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const profile = await appService.getProfile(req.appParent.id);
  res.json(successResponse(profile));
};

export const getChildren = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const children = await appService.getChildren(req.appParent.id);
  res.json(successResponse(children));
};

export const getStudentAttendance = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const records = await appService.getStudentAttendance(
    req.appParent.id,
    req.params.studentId,
    { from: req.query.from as string | undefined, to: req.query.to as string | undefined }
  );
  res.json(successResponse(records));
};

export const getStudentGrades = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const grades = await appService.getStudentGrades(
    req.appParent.id,
    req.params.studentId
  );
  res.json(successResponse(grades));
};

export const getStudentTimetable = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const timetable = await appService.getStudentTimetable(
    req.appParent.id,
    req.params.studentId
  );
  res.json(successResponse(timetable));
};

export const getStudentReports = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const reports = await appService.getStudentReports(
    req.appParent.id,
    req.params.studentId
  );
  res.json(successResponse(reports));
};

export const requestStudentLeave = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const leave = await appService.requestStudentLeave(
    req.appParent.id,
    req.params.studentId,
    req.body
  );
  res.status(201).json(successResponse(leave));
};

export const getStudentLeaves = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const leaves = await appService.getStudentLeaves(
    req.appParent.id,
    req.params.studentId
  );
  res.json(successResponse(leaves));
};

export const cancelStudentLeave = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const result = await appService.cancelStudentLeave(
    req.appParent.id,
    req.params.studentId,
    req.params.leaveId
  );
  res.json(successResponse(result));
};

// ── Finance ─────────────────────────────────────────────────────────────────

export const getStudentFeeSummary = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const summary = await appService.getStudentFeeSummary(
    req.appParent.id,
    req.params.studentId
  );
  res.json(successResponse(summary));
};

export const getStudentInvoices = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const invoices = await appService.getStudentInvoices(
    req.appParent.id,
    req.params.studentId
  );
  res.json(successResponse(invoices));
};

export const getStudentInvoiceById = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const invoice = await appService.getStudentInvoiceById(
    req.appParent.id,
    req.params.studentId,
    req.params.invoiceId
  );
  res.json(successResponse(invoice));
};

export const getStudentTransactions = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const transactions = await appService.getStudentTransactions(
    req.appParent.id,
    req.params.studentId
  );
  res.json(successResponse(transactions));
};

// ── Notifications ───────────────────────────────────────────────────────────

export const getNotifications = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const { page, limit } = req.query as unknown as {
    page: number;
    limit: number;
  };
  const { data, meta } = await appService.getNotifications(req.appParent.id, {
    page,
    limit
  });
  res.json(successResponse(data, meta));
};

export const markNotificationRead = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const result = await appService.markNotificationRead(
    req.appParent.id,
    req.params.notificationId
  );
  res.json(successResponse(result));
};

export const getUnreadNotificationCount = async (req: Request, res: Response) => {
  if (!req.appParent?.id) {
    throw new AppError("unauthorized", "Missing parent context", 401);
  }
  const result = await appService.getUnreadNotificationCount(req.appParent.id);
  res.json(successResponse(result));
};
