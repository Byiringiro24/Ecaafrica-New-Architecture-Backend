import type { ExamStatus, ExamType } from "@prisma/client";
import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as examService from "../services/exam.service";
import { prisma } from "../database/prisma";

const resolveSchoolId = (req: Request) => {
  const schoolId = (req as Request & { user?: { school_id?: string } }).user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

const resolveTeacherId = (req: Request) => {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  if (!userId) {
    throw new AppError("forbidden", "Missing user context", 403);
  }

  return userId;
};

export const listTeacherExams = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const teacherId = resolveTeacherId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const status = req.query.status as ExamStatus | undefined;
  const sectionId = req.query.section_id as string | undefined;
  const subjectId = req.query.subject_id as string | undefined;

  // Get teacher's assigned sections and subjects
  const subjectAssignments = await prisma.teacher_section_subjects.findMany({
    where: {
      school_id: BigInt(schoolId as any),
      teacher_id: BigInt(teacherId as any),
      deleted_at: null
    },
    select: {
      section_id: true,
      subject_id: true
    }
  });

  // Also include sections where the teacher is the class teacher
  const classTeacherSections = await prisma.sections.findMany({
    where: {
      school_id: BigInt(schoolId as any),
      class_teacher_id: BigInt(teacherId as any)
    },
    select: {
      id: true
    }
  });

  const sectionIdsSet = new Set<bigint>();
  subjectAssignments.forEach((assignment) => sectionIdsSet.add(assignment.section_id));
  classTeacherSections.forEach((section) => sectionIdsSet.add(section.id));
  const sectionIds = Array.from(sectionIdsSet);

  // Find exams for teacher's sections or exams created by the teacher
  const where: any = {
    school_id: BigInt(schoolId as any),
    OR: [
      { section_id: { in: sectionIds } },
      { teacher_id: BigInt(teacherId as any) }
    ]
  };

  if (status) {
    where.status = status;
  }

  if (sectionId !== undefined) {
    if (!/^[0-9]+$/.test(sectionId)) {
      throw new AppError("bad_request", "Invalid section id", 400);
    }
    where.section_id = BigInt(sectionId as any);
  }

  if (subjectId !== undefined) {
    if (!/^[0-9]+$/.test(subjectId)) {
      throw new AppError("bad_request", "Invalid subject id", 400);
    }
    where.subject_id = BigInt(subjectId as any);
  }

  const [exams, total] = await prisma.$transaction([
    prisma.exams.findMany({
      where,
      orderBy: { exam_date: "desc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      include: {
        subject: true,
        section: true,
        _count: {
          select: { exam_results: true }
        }
      }
    }),
    prisma.exams.count({ where })
  ]);

  const formatted = await Promise.all(
    exams.map(async (exam) => {
      let pass_rate: string | undefined;
      let average_score: string | undefined;

      if (exam.status === "completed") {
        const results = await prisma.exam_results.findMany({
          where: { exam_id: exam.id },
          select: { marks_obtained: true, is_absent: true }
        });

        const scored = results.filter((r) => !r.is_absent && r.marks_obtained !== null);
        const passMark = Number(exam.pass_mark);

        if (scored.length > 0) {
          const scores = scored.map((r) => Number(r.marks_obtained));
          const passCount = scores.filter((s) => s >= passMark).length;
          pass_rate = Math.round((passCount / results.length) * 100).toString();
          average_score = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        } else {
          pass_rate = "0";
          average_score = "0";
        }
      }

      return {
        id: exam.id.toString(),
        school_id: exam.school_id.toString(),
        name: exam.name,
        subject_id: exam.subject_id.toString(),
        section_id: exam.section_id ? exam.section_id.toString() : null,
        teacher_id: exam.teacher_id ? exam.teacher_id.toString() : null,
        term_id: exam.term_id ? exam.term_id.toString() : null,
        type: exam.type,
        exam_date: exam.exam_date,
        start_time: exam.start_time,
        duration_min: exam.duration_min,
        max_marks: exam.max_marks.toString(),
        pass_mark: exam.pass_mark.toString(),
        status: exam.status,
        published_at: exam.published_at,
        published_by: exam.published_by ? exam.published_by.toString() : null,
        created_at: exam.created_at,
        updated_at: exam.updated_at,
        subject: exam.subject
          ? {
              id: exam.subject.id.toString(),
              name: exam.subject.name,
              code: exam.subject.code
            }
          : null,
        section: exam.section
          ? {
              id: exam.section.id.toString(),
              name: exam.section.name,
              full_name: exam.section.full_name
            }
          : null,
        marked_count: exam._count.exam_results,
        pass_rate,
        average_score
      };
    })
  );

  res.json(successResponse(formatted, { page: pagination.page, limit: pagination.limit, total }));
};

export const getTeacherAssignments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const teacherId = resolveTeacherId(req);

  const teacherAssignments = await prisma.teacher_section_subjects.findMany({
    where: {
      school_id: BigInt(schoolId as any),
      teacher_id: BigInt(teacherId as any),
      deleted_at: null
    },
    include: {
      section: {
        select: {
          id: true,
          name: true,
          full_name: true,
          class_id: true
        }
      },
      subject: {
        select: {
          id: true,
          name: true,
          code: true
        }
      }
    }
  });

  const classTeacherSections = await prisma.sections.findMany({
    where: {
      school_id: BigInt(schoolId as any),
      class_teacher_id: BigInt(teacherId as any),
      deleted_at: null
    },
    select: {
      id: true,
      name: true,
      full_name: true,
      class_id: true
    }
  });

  const sectionIds = new Set<bigint>();
  teacherAssignments.forEach((assignment) => sectionIds.add(assignment.section_id));
  classTeacherSections.forEach((section) => sectionIds.add(section.id));

  const sectionEntries: Array<[bigint, { id: bigint; name: string; full_name: string; class_id: bigint }]> = [];
  teacherAssignments.forEach((a) => {
    sectionEntries.push([a.section_id, a.section]);
  });
  classTeacherSections.forEach((s) => {
    sectionEntries.push([s.id, s]);
  });

  const sectionMap = new Map<bigint, { id: bigint; name: string; full_name: string; class_id: bigint }>(sectionEntries);
  const sections = Array.from(sectionMap.values());

  const subjectEntries: Array<[bigint, { id: bigint; name: string; code?: string | null }]> = [];
  teacherAssignments.forEach((entry) => {
    subjectEntries.push([entry.subject_id, entry.subject]);
  });
  const subjectMap = new Map<bigint, { id: bigint; name: string; code?: string | null }>(subjectEntries);
  const subjects = Array.from(subjectMap.values());

  return res.json(
    successResponse({
      sections: sections.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        full_name: s.full_name,
        class_id: s.class_id.toString()
      })),
      subjects: subjects.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        code: s.code
      })),
      assignments: teacherAssignments.map((a) => ({
        section_id: a.section_id.toString(),
        subject_id: a.subject_id.toString(),
        section: {
          id: a.section.id.toString(),
          name: a.section.name,
          full_name: a.section.full_name
        },
        subject: {
          id: a.subject.id.toString(),
          name: a.subject.name,
          code: a.subject.code
        }
      }))
    })
  );
};

const resolveActor = (req: Request) => ({
  id: req.user?.id,
  role: req.user?.role
});

export const createExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const teacherId = resolveTeacherId(req);

  // Set teacher as the creator if not specified
  if (!req.body.teacher_id) {
    req.body.teacher_id = teacherId;
  }

  const record = await examService.createExam(schoolId, req.body, resolveActor(req));
  res.status(201).json(successResponse(record));
};

export const listExams = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    section_id: req.query.section_id as string | undefined,
    subject_id: req.query.subject_id as string | undefined,
    term_id: req.query.term_id as string | undefined,
    status: req.query.status as ExamStatus | undefined,
    type: req.query.type as ExamType | undefined
  };

  const result = await examService.findAllExams(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await examService.findExamById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const updateExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await examService.updateExam(
    schoolId,
    req.params.id,
    req.body,
    resolveActor(req)
  );
  res.json(successResponse(record));
};

export const deleteExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await examService.deleteExam(
    schoolId,
    req.params.id,
    resolveActor(req)
  );
  res.json(successResponse(record));
};
