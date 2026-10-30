import type { VisitorAppointmentStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as appointmentService from "../../services/visitor/appointment.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const createAppointment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await appointmentService.createAppointment(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listAppointments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    visitor_id: req.query.visitor_id as string | undefined,
    student_id: req.query.student_id as string | undefined,
    host_id: req.query.host_id as string | undefined,
    status: req.query.status as VisitorAppointmentStatus | undefined,
    from_date: req.query.from_date as string | undefined,
    to_date: req.query.to_date as string | undefined
  };
  const result = await appointmentService.findAllAppointments(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getAppointment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await appointmentService.findAppointmentById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateAppointment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await appointmentService.updateAppointment(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteAppointment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await appointmentService.deleteAppointment(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const confirmAppointment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await appointmentService.confirmAppointment(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const cancelAppointment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await appointmentService.cancelAppointment(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const completeAppointment = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await appointmentService.completeAppointment(schoolId, req.params.id);
  res.json(successResponse(record));
};
