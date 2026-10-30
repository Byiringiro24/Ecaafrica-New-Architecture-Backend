import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as timetableSlotService from "../services/timetable-slot.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const createTimetableSlot = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await timetableSlotService.createTimetableSlot(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listTimetableSlots = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    section_id: req.query.section_id as string | undefined,
    subject_id: req.query.subject_id as string | undefined,
    teacher_id: req.query.teacher_id as string | undefined,
    term_id: req.query.term_id as string | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await timetableSlotService.findAllTimetableSlots(
    schoolId,
    pagination,
    filters
  );
  res.json(successResponse(result.data, result.meta));
};

export const getTimetableSlot = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await timetableSlotService.findTimetableSlotById(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};

export const updateTimetableSlot = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await timetableSlotService.updateTimetableSlot(
    schoolId,
    req.params.id,
    req.body
  );
  res.json(successResponse(record));
};

export const deleteTimetableSlot = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await timetableSlotService.softDeleteTimetableSlot(
    schoolId,
    req.params.id
  );
  res.json(successResponse(record));
};

// POST /timetable-slots/bulk
// Creates one slot per section_id for the same teacher/subject/period/day.
// Designed for combined-class lessons (e.g. S-4A + S-4B + S-4C share one teacher).
export const bulkCreateTimetableSlots = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await timetableSlotService.bulkCreateTimetableSlots(schoolId, req.body);
  res.status(201).json(successResponse(result));
};

export const copyLegacyTimetable = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await timetableSlotService.copyLegacyTimetable(schoolId, req.body.term_id);
  res.status(201).json(successResponse(result));
};

// POST /timetable-slots/generate
// DOS-facing endpoint: accept a full-week template and auto-create all slots.
// Skips conflicts by default; pass overwrite_existing:true to replace them.
export const generateTimetableSlots = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await timetableSlotService.generateTimetableSlots(schoolId, req.body);
  res.json(successResponse(result));
};
