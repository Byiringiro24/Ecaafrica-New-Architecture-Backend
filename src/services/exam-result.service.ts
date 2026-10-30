import type { Prisma, exam_results } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";
import { createStudentNotifications } from "./app.service";

type ResultItem = {
  student_id: string | number | bigint;
  score?: string | number;
  grade?: string;
  remarks?: string;
  is_absent?: boolean;
};

type ResultCreateInput = {
  exam_id: string | number | bigint;
  student_id: string | number | bigint;
  score?: string | number;
  grade?: string;
  remarks?: string;
  is_absent?: boolean;
  entered_by?: string | number | bigint;
};

type ResultUpdateInput = {
  score?: string | number;
  grade?: string;
  remarks?: string;
  is_absent?: boolean;
};

type ResultFilters = {
  exam_id?: string | number | bigint;
  student_id?: string | number | bigint;
};

type Actor = {
  id?: string | number | bigint;
  role?: string;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDecimal = (value: string | number) =>
  typeof value === "string" ? value : value.toString();

const computeGrade = (score: number, maxMarks: number): string => {
  const percent = maxMarks > 0 ? (score / maxMarks) * 100 : 0;
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "F";
};

const computeConfiguredGrade = (
  score: number,
  maxMarks: number,
  roles: Array<{ code: string; min_percentage: unknown; max_percentage: unknown }>
): string => {
  const percentage = maxMarks > 0 ? (score / maxMarks) * 100 : 0;
  const role = roles.find((item) => percentage >= Number(item.min_percentage) && percentage <= Number(item.max_percentage));
  return role?.code ?? computeGrade(score, maxMarks);
};

const resolveGrade = (
  input: ResultCreateInput | ResultItem,
  maxMarks: number,
  gradingRoles: Array<{ code: string; min_percentage: unknown; max_percentage: unknown }> = []
): string | null | undefined => {
  if (input.is_absent) return null;
  if (input.score === undefined || input.score === "") return undefined;
  const score = Number(input.score);
  if (Number.isNaN(score)) return undefined;
  return gradingRoles.length > 0
    ? computeConfiguredGrade(score, maxMarks, gradingRoles)
    : input.grade ?? computeGrade(score, maxMarks);
};

const formatResult = (record: exam_results) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  exam_id: record.exam_id.toString(),
  student_id: record.student_id.toString(),
  entered_by: record.entered_by ? record.entered_by.toString() : null,
  marks_obtained: record.marks_obtained ? record.marks_obtained.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "marks_obtained", "grade"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.exam_resultsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.exam_resultsOrderByWithRelationInput;
};

const assertExam = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  examId: string | number | bigint
) => {
  const exam = await tx.exams.findFirst({
    where: {
      id: toBigInt(examId),
      school_id: toBigInt(schoolId)
    }
  });

  if (!exam) {
    throw new AppError("not_found", "Exam not found", 404);
  }

  return exam;
};

// Teachers may only touch marks for a section+subject they are assigned to.
// Admins bypass; any other role has already been rejected by the route guard.
const assertTeacherOwnsExam = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  exam: { section_id: bigint | null; subject_id: bigint },
  actor?: Actor
) => {
  if (actor?.role !== "teacher") {
    return;
  }

  if (!actor.id) {
    throw new AppError("forbidden", "Missing user context", 403);
  }

  if (!exam.section_id) {
    throw new AppError(
      "forbidden",
      "This exam has no class assigned. Ask your administrator to set one.",
      403
    );
  }

  const assignment = await tx.teacher_section_subjects.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      teacher_id: toBigInt(actor.id),
      section_id: exam.section_id,
      subject_id: exam.subject_id,
      deleted_at: null
    }
  });

  if (!assignment) {
    throw new AppError(
      "forbidden",
      "You are not assigned to this class and subject",
      403
    );
  }
};

// Once an admin publishes, marks are frozen. Admins can unpublish to reopen.
const assertNotPublished = (exam: { published_at: Date | null }) => {
  if (exam.published_at) {
    throw new AppError(
      "conflict",
      "Results are published and can no longer be edited. Ask your administrator to unpublish first.",
      409
    );
  }
};

// A teacher may enter marks for a scheduled exam. Once results have been
// submitted, editing requires an approved modification request, which puts
// the exam back into the scheduled state. Unpublishing only changes parent
// visibility and must not silently grant edit access.
const assertTeacherCanEdit = (
  exam: { status?: string },
  actor?: Actor
) => {
  // Treat missing status as 'scheduled' (allow editing). Only block when
  // status is present and differs from 'scheduled'.
  if (actor?.role === "teacher" && exam.status !== undefined && exam.status !== "scheduled") {
    throw new AppError(
      "conflict",
      "Results have been submitted and are locked. Request approval from the school administrator before editing.",
      409
    );
  }
};

const assertStudent = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await tx.students.findFirst({
    where: {
      id: toBigInt(studentId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  return student;
};

const buildResultCreateData = (
  schoolId: string | number | bigint,
  examId: bigint,
  studentId: bigint,
  input: ResultCreateInput | ResultItem,
  enteredBy?: bigint,
  maxMarks?: number,
  gradingRoles: Array<{ code: string; min_percentage: unknown; max_percentage: unknown }> = []
): Prisma.exam_resultsUncheckedCreateInput => ({
  school_id: toBigInt(schoolId),
  exam_id: examId,
  student_id: studentId,
  marks_obtained:
    input.is_absent || input.score === undefined ? null : toDecimal(input.score),
  grade: maxMarks !== undefined ? resolveGrade(input, maxMarks, gradingRoles) : input.grade,
  remarks: input.remarks,
  is_absent: input.is_absent ?? false,
  entered_by: enteredBy,
  entered_at: new Date()
});

const buildResultUpdateData = (
  input: ResultCreateInput | ResultItem,
  enteredBy?: bigint,
  maxMarks?: number,
  gradingRoles: Array<{ code: string; min_percentage: unknown; max_percentage: unknown }> = []
): Prisma.exam_resultsUpdateInput => {
  const data: Prisma.exam_resultsUpdateInput = {
    entered_by: enteredBy,
    entered_at: new Date()
  };

  if (input.score !== undefined) {
    data.marks_obtained = input.is_absent ? null : toDecimal(input.score);
  } else if (input.is_absent) {
    data.marks_obtained = null;
  }

  if (maxMarks !== undefined) {
    const grade = resolveGrade(input, maxMarks, gradingRoles);
    if (grade !== undefined) data.grade = grade;
  } else if (input.grade !== undefined) {
    data.grade = input.grade;
  }
  if (input.remarks !== undefined) data.remarks = input.remarks;
  if (input.is_absent !== undefined) data.is_absent = input.is_absent;

  return data;
};

export const recordResult = async (
  schoolId: string | number | bigint,
  input: ResultCreateInput,
  actor?: Actor
) =>
  prisma.$transaction(async (tx) => {
    const exam = await assertExam(tx, schoolId, input.exam_id);
    assertNotPublished(exam);
    assertTeacherCanEdit(exam, actor);
    await assertTeacherOwnsExam(tx, schoolId, exam, actor);
    await assertStudent(tx, schoolId, input.student_id);

    const examId = toBigInt(input.exam_id);
    const studentId = toBigInt(input.student_id);
    const enteredBy = input.entered_by ? toBigInt(input.entered_by) : undefined;
    const maxMarks = Number(exam.max_marks);
    const gradingRoles = await tx.grading_roles.findMany({
      where: { school_id: toBigInt(schoolId), is_active: true },
      select: { code: true, min_percentage: true, max_percentage: true }
    });

    const existing = await tx.exam_results.findUnique({
      where: {
        exam_id_student_id: {
          exam_id: examId,
          student_id: studentId
        }
      }
    });

    const record = existing
      ? await tx.exam_results.update({
          where: { id: existing.id },
          data: buildResultUpdateData(input, enteredBy, maxMarks, gradingRoles)
        })
      : await tx.exam_results.create({
          data: buildResultCreateData(schoolId, examId, studentId, input, enteredBy, maxMarks, gradingRoles)
        });

    return formatResult(record);
  });

export const bulkRecordResults = async (
  schoolId: string | number | bigint,
  examId: string | number | bigint,
  results: ResultItem[],
  enteredBy?: string | number | bigint,
  actor?: Actor
) =>
  prisma.$transaction(async (tx) => {
    const exam = await assertExam(tx, schoolId, examId);
    assertNotPublished(exam);
    assertTeacherCanEdit(exam, actor);
    await assertTeacherOwnsExam(tx, schoolId, exam, actor);

    const examIdBig = toBigInt(examId);
    const enteredByBig = enteredBy ? toBigInt(enteredBy) : undefined;
    const maxMarks = Number(exam.max_marks);
    const gradingRoles = await tx.grading_roles.findMany({
      where: { school_id: toBigInt(schoolId), is_active: true },
      select: { code: true, min_percentage: true, max_percentage: true }
    });
    const saved: exam_results[] = [];

    for (const item of results) {
      await assertStudent(tx, schoolId, item.student_id);

      const studentId = toBigInt(item.student_id);
      const existing = await tx.exam_results.findUnique({
        where: {
          exam_id_student_id: {
            exam_id: examIdBig,
            student_id: studentId
          }
        }
      });

      const record = existing
        ? await tx.exam_results.update({
            where: { id: existing.id },
            data: buildResultUpdateData(item, enteredByBig, maxMarks, gradingRoles)
          })
        : await tx.exam_results.create({
            data: buildResultCreateData(
              schoolId,
              examIdBig,
              studentId,
              item,
              enteredByBig,
              maxMarks,
              gradingRoles
            )
          });

      saved.push(record);
    }

    return saved.map(formatResult);
  });

export const getResultsByStudent = async (
  schoolId: string | number | bigint,
  studentId: string,
  pagination: PaginationParams
) => {
  if (!/^\d+$/.test(studentId)) {
    throw new AppError("bad_request", "Invalid student id", 400);
  }

  await assertStudent(prisma, schoolId, studentId);

  const { page, limit, sort, order } = pagination;
  const where: Prisma.exam_resultsWhereInput = {
    school_id: toBigInt(schoolId),
    student_id: toBigInt(studentId)
  };

  const [items, total] = await prisma.$transaction([
    prisma.exam_results.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            type: true,
            exam_date: true,
            max_marks: true,
            pass_mark: true
          }
        }
      }
    }),
    prisma.exam_results.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatResult(item),
      exam: item.exam
        ? {
            ...item.exam,
            id: item.exam.id.toString(),
            max_marks: item.exam.max_marks.toString(),
            pass_mark: item.exam.pass_mark.toString()
          }
        : null
    })),
    meta: { page, limit, total }
  };
};

export const getResultsByExam = async (
  schoolId: string | number | bigint,
  examId: string,
  pagination: PaginationParams
) => {
  if (!/^\d+$/.test(examId)) {
    throw new AppError("bad_request", "Invalid exam id", 400);
  }

  const exam = await assertExam(prisma, schoolId, examId);

  const { page, limit, sort, order } = pagination;
  const where: Prisma.exam_resultsWhereInput = {
    school_id: toBigInt(schoolId),
    exam_id: toBigInt(examId)
  };

  const [items, total, allMarks] = await prisma.$transaction([
    prisma.exam_results.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        student: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            student_id_number: true
          }
        }
      }
    }),
    prisma.exam_results.count({ where }),
    prisma.exam_results.findMany({
      where: {
        ...where,
        is_absent: false,
        marks_obtained: { not: null }
      },
      select: { marks_obtained: true }
    })
  ]);

  const scores = allMarks
    .map((r) => (r.marks_obtained ? Number(r.marks_obtained) : null))
    .filter((v): v is number => v !== null);

  const stats =
    scores.length > 0
      ? {
          class_average: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
          highest: Math.max(...scores).toFixed(2),
          lowest: Math.min(...scores).toFixed(2),
          count: scores.length
        }
      : {
          class_average: null,
          highest: null,
          lowest: null,
          count: 0
        };

  return {
    exam: {
      id: exam.id.toString(),
      name: exam.name,
      max_marks: exam.max_marks.toString(),
      pass_mark: exam.pass_mark.toString()
    },
    stats,
    data: items.map((item) => ({
      ...formatResult(item),
      student: item.student
        ? { ...item.student, id: item.student.id.toString() }
        : null
    })),
    meta: { page, limit, total }
  };
};

export const getExamResultSummary = async (
  schoolId: string | number | bigint,
  examId: string
) => {
  const result = await getResultsByExam(schoolId, examId, {
    page: 1,
    limit: 1,
    sort: undefined,
    order: undefined,
    q: undefined
  });

  const allResults = await prisma.exam_results.findMany({
    where: {
      school_id: toBigInt(schoolId),
      exam_id: toBigInt(examId)
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
    }
  });

  return {
    exam: result.exam,
    stats: result.stats,
    total_results: allResults.length,
    absent_count: allResults.filter((r) => r.is_absent).length,
    passed_count: allResults.filter((r) => {
      if (r.is_absent || !r.marks_obtained) return false;
      return Number(r.marks_obtained) >= Number(result.exam.pass_mark);
    }).length,
    results: allResults.map((item) => ({
      ...formatResult(item),
      student: item.student
        ? { ...item.student, id: item.student.id.toString() }
        : null
    }))
  };
};

export const findAllResults = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: ResultFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.exam_resultsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.exam_id) where.exam_id = toBigInt(filters.exam_id);
  if (filters.student_id) where.student_id = toBigInt(filters.student_id);

  const [items, total] = await prisma.$transaction([
    prisma.exam_results.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.exam_results.count({ where })
  ]);

  return {
    data: items.map(formatResult),
    meta: { page, limit, total }
  };
};

export const findResultById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid result id", 400);
  }

  const record = await prisma.exam_results.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      exam: true,
      student: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          student_id_number: true
        }
      }
    }
  });

  if (!record) {
    throw new AppError("not_found", "Exam result not found", 404);
  }

  return {
    ...formatResult(record),
    exam: record.exam
      ? {
          id: record.exam.id.toString(),
          name: record.exam.name,
          type: record.exam.type,
          exam_date: record.exam.exam_date,
          max_marks: record.exam.max_marks.toString(),
          pass_mark: record.exam.pass_mark.toString()
        }
      : null,
    student: record.student
      ? { ...record.student, id: record.student.id.toString() }
      : null
  };
};

export const updateResult = async (
  schoolId: string | number | bigint,
  id: string,
  input: ResultUpdateInput,
  enteredBy?: string | number | bigint,
  actor?: Actor
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid result id", 400);
  }

  const existing = await prisma.exam_results.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Exam result not found", 404);
  }

  const exam = await assertExam(prisma, schoolId, existing.exam_id);
  assertNotPublished(exam);
  await assertTeacherOwnsExam(prisma, schoolId, exam, actor);

  const data: Prisma.exam_resultsUpdateInput = {
    entered_at: new Date(),
    entered_by: enteredBy ? toBigInt(enteredBy) : existing.entered_by
  };

  if (input.score !== undefined) {
    data.marks_obtained = input.is_absent ? null : toDecimal(input.score);
  } else if (input.is_absent !== undefined && input.is_absent) {
    data.marks_obtained = null;
  }

  if (input.grade !== undefined) data.grade = input.grade;
  if (input.remarks !== undefined) data.remarks = input.remarks;
  if (input.is_absent !== undefined) data.is_absent = input.is_absent;

  const updated = await prisma.exam_results.update({
    where: { id: existing.id },
    data
  });

  return formatResult(updated);
};

export const deleteResult = async (
  schoolId: string | number | bigint,
  id: string,
  actor?: Actor
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid result id", 400);
  }

  const existing = await prisma.exam_results.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Exam result not found", 404);
  }

  const exam = await assertExam(prisma, schoolId, existing.exam_id);
  assertNotPublished(exam);
  await assertTeacherOwnsExam(prisma, schoolId, exam, actor);

  await prisma.exam_results.delete({ where: { id: existing.id } });

  return formatResult(existing);
};

export const publishExamResults = async (
  schoolId: string | number | bigint,
  examId: string,
  publishedBy?: string | number | bigint
) => {
  if (!/^\d+$/.test(examId)) {
    throw new AppError("bad_request", "Invalid exam id", 400);
  }

  const published = await prisma.$transaction(async (tx) => {
    const exam = await assertExam(tx, schoolId, examId);

    const resultCount = await tx.exam_results.count({
      where: { exam_id: exam.id }
    });

    if (resultCount === 0) {
      throw new AppError(
        "bad_request",
        "No marks have been recorded for this exam yet",
        400
      );
    }

    const publishedAt = new Date();

    await tx.exam_results.updateMany({
      where: { exam_id: exam.id },
      data: { published_at: publishedAt }
    });

    const updated = await tx.exams.update({
      where: { id: exam.id },
      data: {
        status: "completed",
        published_at: publishedAt,
        published_by: publishedBy ? toBigInt(publishedBy) : null
      }
    });

    return {
      id: updated.id.toString(),
      name: updated.name,
      status: updated.status,
      published_at: updated.published_at,
      published_by: updated.published_by ? updated.published_by.toString() : null,
      published_count: resultCount
    };
  });

  // The result is committed before the notification fan-out. A notification
  // failure must never roll back a successful grade publication.
  try {
    const students = await prisma.exam_results.findMany({
      where: { exam_id: toBigInt(examId), published_at: { not: null } },
      select: { student_id: true },
      distinct: ["student_id"]
    });
    await createStudentNotifications(
      schoolId,
      students.map((student) => student.student_id),
      {
        title: "Grades Published",
        body: `${published.name} results are now available to view.`,
        type: "grade_published",
        metadata: {
          exam_id: published.id,
          published_count: published.published_count
        }
      }
    );
  } catch {
    // The grades are already published; a later refresh can still show them.
  }

  return published;
};

export const unpublishExamResults = async (
  schoolId: string | number | bigint,
  examId: string
) => {
  if (!/^\d+$/.test(examId)) {
    throw new AppError("bad_request", "Invalid exam id", 400);
  }

  return prisma.$transaction(async (tx) => {
    const exam = await assertExam(tx, schoolId, examId);

    if (!exam.published_at) {
      throw new AppError("bad_request", "This exam is not published", 400);
    }

    await tx.exam_results.updateMany({
      where: { exam_id: exam.id },
      data: { published_at: null }
    });

    const updated = await tx.exams.update({
      where: { id: exam.id },
      data: {
        // Keep the submitted state. Removing publication is not approval to
        // edit; a teacher must use the modification-request workflow.
        status: "ongoing",
        published_at: null,
        published_by: null
      }
    });

    return {
      id: updated.id.toString(),
      status: updated.status,
      published_at: null,
      published_by: null
    };
  });
};
