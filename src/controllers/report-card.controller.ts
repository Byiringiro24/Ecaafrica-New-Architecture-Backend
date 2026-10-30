import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as reportCardService from "../services/report-card.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const getStudentReportCard = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const card = await reportCardService.getStudentReportCard(
    schoolId,
    req.params.studentId,
    req.query.term_id as string | undefined,
    req.user?.id
  );
  res.json(successResponse(card));
};

export const getSectionReportCards = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const cards = await reportCardService.getSectionReportCards(
    schoolId,
    req.params.sectionId,
    req.query.term_id as string | undefined,
    req.user?.id
  );
  res.json(successResponse(cards));
};

export const publishSectionReportCards = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await reportCardService.publishSectionReportCards(
    schoolId,
    req.params.sectionId,
    req.query.term_id as string | undefined,
    req.user?.id
  );
  res.json(successResponse(result));
};
