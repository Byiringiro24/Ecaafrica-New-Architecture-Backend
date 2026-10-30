import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as sectionService from "../services/section.service";
import { prisma } from "../database/prisma";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const getSectionStudents = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const sectionId = req.params.id;
  const pagination = parsePagination(req.query as Record<string, string>);

  // Verify section exists and belongs to school
  const section = await prisma.sections.findFirst({
    where: {
      id: BigInt(sectionId),
      school_id: BigInt(schoolId as any),
      deleted_at: null
    }
  });

  if (!section) {
    throw new AppError("not_found", "Section not found", 404);
  }

  // Get students enrolled in this section
  const [students, total] = await prisma.$transaction([
    prisma.student_section_enrollments.findMany({
      where: {
        section_id: section.id,
        school_id: BigInt(schoolId as any),
        status: "active"
      },
      include: {
        student: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            student_id_number: true
          }
        }
      },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: { student: { first_name: "asc" } }
    }),
    prisma.student_section_enrollments.count({
      where: {
        section_id: section.id,
        school_id: BigInt(schoolId as any),
        status: "active"
      }
    })
  ]);

  const formatted = students.map(enrollment => ({
    id: enrollment.student.id.toString(),
    first_name: enrollment.student.first_name,
    last_name: enrollment.student.last_name,
    student_id_number: enrollment.student.student_id_number
  }));

  res.json(successResponse(formatted, { page: pagination.page, limit: pagination.limit, total }));
};

export const createSection = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await sectionService.createSection(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const listSections = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    class_id: req.query.class_id as string | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await sectionService.findAllSections(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getSection = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await sectionService.findSectionById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateSection = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await sectionService.updateSection(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteSection = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await sectionService.softDeleteSection(schoolId, req.params.id);
  res.json(successResponse(record));
};
