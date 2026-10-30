import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as examResultService from "../services/exam-result.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

const resolveActor = (req: Request) => ({
  id: req.user?.id,
  role: req.user?.role
});

export const createResult = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await examResultService.recordResult(
    schoolId,
    {
      ...req.body,
      entered_by: req.user?.id
    },
    resolveActor(req)
  );
  res.status(201).json(successResponse(record));
};

export const bulkRecordResults = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const { exam_id, results } = req.body;
  const records = await examResultService.bulkRecordResults(
    schoolId,
    exam_id,
    results,
    req.user?.id,
    resolveActor(req)
  );
  res.status(201).json(successResponse(records));
};

export const publishResults = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await examResultService.publishExamResults(
    schoolId,
    req.params.examId,
    req.user?.id
  );
  res.json(successResponse(result));
};

export const unpublishResults = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await examResultService.unpublishExamResults(
    schoolId,
    req.params.examId
  );
  res.json(successResponse(result));
};

export const listResults = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    exam_id: req.query.exam_id as string | undefined,
    student_id: req.query.student_id as string | undefined
  };

  const result = await examResultService.findAllResults(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getResult = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await examResultService.findResultById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateResult = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await examResultService.updateResult(
    schoolId,
    req.params.id,
    req.body,
    req.user?.id,
    resolveActor(req)
  );
  res.json(successResponse(record));
};

export const deleteResult = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await examResultService.deleteResult(
    schoolId,
    req.params.id,
    resolveActor(req)
  );
  res.json(successResponse(record));
};

export const getResultsByStudent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await examResultService.getResultsByStudent(
    schoolId,
    req.params.studentId,
    pagination
  );
  res.json(successResponse(result.data, result.meta));
};

export const getResultsByExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await examResultService.getResultsByExam(
    schoolId,
    req.params.examId,
    pagination
  );
  res.json(
    successResponse({
      exam: result.exam,
      stats: result.stats,
      results: result.data
    }, result.meta)
  );
};

export const getExamSummary = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const summary = await examResultService.getExamResultSummary(
    schoolId,
    req.params.examId
  );
  res.json(successResponse(summary));
};
