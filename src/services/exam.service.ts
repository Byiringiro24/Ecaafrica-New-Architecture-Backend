import { type ExamStatus, type ExamType, type Prisma, type exams } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type ExamCreateInput = {
  section_id?: string | number | bigint;
  subject_id: string | number | bigint;
  teacher_id?: string | number | bigint;
  term_id?: string | number | bigint;
  exam_type_id?: string | number | bigint;
  name: string;
  type?: ExamType;
  exam_date?: string | Date;
  start_time?: string;
  duration_min?: number;
  max_marks?: string | number;
  pass_mark?: string | number;
  status?: ExamStatus;
};

type ExamUpdateInput = Partial<ExamCreateInput>;

type ExamFilters = {
  section_id?: string | number | bigint;
  subject_id?: string | number | bigint;
  term_id?: string | number | bigint;
  status?: ExamStatus;
  type?: ExamType;
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

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const toDecimal = (value: string | number) =>
  typeof value === "string" ? value : value.toString();

const configuredPassPercentage = (roles: Array<{ code: string; min_percentage: unknown; max_percentage: unknown }>) => {
  const passingRoles = roles.filter((role) => !/^(f|fail)/i.test(role.code.trim()));
  if (passingRoles.length > 0) {
    return Math.min(...passingRoles.map((role) => Number(role.min_percentage)));
  }
  const failingRole = roles.find((role) => /^(f|fail)/i.test(role.code.trim()));
  return failingRole ? Math.min(Number(failingRole.max_percentage) + 1, 100) : 50;
};

const parseTimeToMinutes = (time: Date | null | undefined) => {
  if (!time) return null;
  return time.getUTCHours() * 60 + time.getUTCMinutes();
};

const parseStartTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) {
    throw new AppError("bad_request", "Invalid start_time format (use HH:mm)", 400);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  const date = new Date(1970, 0, 1, hours, minutes, seconds);
  return date;
};

const formatExam = (record: exams & { exam_type?: { id: bigint; name: string } | null }) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  section_id: record.section_id ? record.section_id.toString() : null,
  subject_id: record.subject_id.toString(),
  teacher_id: record.teacher_id ? record.teacher_id.toString() : null,
  term_id: record.term_id ? record.term_id.toString() : null,
  exam_type_id: record.exam_type_id ? record.exam_type_id.toString() : null,
  exam_type: record.exam_type
    ? { id: record.exam_type.id.toString(), name: record.exam_type.name }
    : null,
  max_marks: record.max_marks.toString(),
  pass_mark: record.pass_mark.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "exam_date", "name", "status"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.examsOrderByWithRelationInput;
  }

  return { exam_date: "desc" } as Prisma.examsOrderByWithRelationInput;
};

const assertSubject = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  subjectId: string | number | bigint
) => {
  const subject = await tx.subjects.findFirst({
    where: {
      id: toBigInt(subjectId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!subject) {
    throw new AppError("not_found", "Subject not found", 404);
  }

  return subject;
};

const assertSection = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  sectionId: string | number | bigint
) => {
  const section = await tx.sections.findFirst({
    where: {
      id: toBigInt(sectionId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!section) {
    throw new AppError("not_found", "Section not found", 404);
  }

  return section;
};

const assertTeacher = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  teacherId: string | number | bigint
) => {
  const teacher = await tx.users.findFirst({
    where: {
      id: toBigInt(teacherId),
      school_id: toBigInt(schoolId),
      role: "teacher",
      deleted_at: null
    }
  });

  if (!teacher) {
    throw new AppError("not_found", "Teacher not found", 404);
  }

  return teacher;
};

const assertTeacherSubjectAssignment = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  teacherId: string | number | bigint,
  subjectId: string | number | bigint,
  sectionId?: string | number | bigint | null
) => {
  const where: Prisma.teacher_section_subjectsWhereInput = {
    school_id: toBigInt(schoolId),
    teacher_id: toBigInt(teacherId),
    subject_id: toBigInt(subjectId),
    deleted_at: null
  };

  if (sectionId) {
    where.section_id = toBigInt(sectionId);
  }

  const assignment = await tx.teacher_section_subjects.findFirst({ where });

  if (!assignment) {
    throw new AppError(
      "forbidden",
      sectionId
        ? "Teacher is not assigned to this class and subject"
        : "Teacher is not assigned to this subject",
      403
    );
  }
};

// A teacher may only mutate exams for a section+subject they are assigned to.
// Admins bypass; other roles are already rejected by the route guard.
const assertActorOwnsExam = async (
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

  await assertTeacherSubjectAssignment(
    tx,
    schoolId,
    actor.id,
    exam.subject_id,
    exam.section_id
  );
};

const timesOverlap = (
  startA: Date | null,
  durationA: number | null,
  startB: Date | null,
  durationB: number | null
) => {
  const startMinutesA = parseTimeToMinutes(startA);
  const startMinutesB = parseTimeToMinutes(startB);

  if (startMinutesA === null || startMinutesB === null) {
    return false;
  }

  const endMinutesA = startMinutesA + (durationA ?? 0);
  const endMinutesB = startMinutesB + (durationB ?? 0);

  return startMinutesA < endMinutesB && startMinutesB < endMinutesA;
};

export const assertNoScheduleConflict = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  input: {
    section_id?: string | number | bigint | null;
    exam_date?: string | Date | null;
    start_time?: string | Date | null;
    duration_min?: number | null;
    excludeExamId?: bigint;
  }
) => {
  if (!input.section_id || !input.exam_date || !input.start_time || !input.duration_min) {
    return;
  }

  const sectionId = toBigInt(input.section_id);
  const examDate = toDateValue(input.exam_date);
  const startTime =
    typeof input.start_time === "string"
      ? parseStartTime(input.start_time)
      : input.start_time;

  const candidates = await tx.exams.findMany({
    where: {
      school_id: toBigInt(schoolId),
      section_id: sectionId,
      exam_date: examDate,
      id: input.excludeExamId ? { not: input.excludeExamId } : undefined,
      status: { not: "cancelled" }
    }
  });

  const conflict = candidates.find((exam) =>
    timesOverlap(startTime, input.duration_min ?? null, exam.start_time, exam.duration_min)
  );

  if (conflict) {
    throw new AppError(
      "conflict",
      `Exam schedule conflicts with existing exam "${conflict.name}"`,
      409
    );
  }
};

export const createExam = async (
  schoolId: string | number | bigint,
  input: ExamCreateInput,
  actor?: Actor
) =>
  prisma.$transaction(async (tx) => {
    await assertSubject(tx, schoolId, input.subject_id);

    if (input.section_id) {
      await assertSection(tx, schoolId, input.section_id);
    }

    if (input.teacher_id) {
      await assertTeacher(tx, schoolId, input.teacher_id);
    }

    if (input.exam_type_id) {
      const examType = await tx.exam_types.findFirst({
        where: { id: toBigInt(input.exam_type_id), school_id: toBigInt(schoolId), is_active: true }
      });
      if (!examType) throw new AppError("not_found", "Exam type not found", 404);
    }

    await assertActorOwnsExam(
      tx,
      schoolId,
      {
        section_id: input.section_id ? toBigInt(input.section_id) : null,
        subject_id: toBigInt(input.subject_id)
      },
      actor
    );

    const teacherId = input.teacher_id ? input.teacher_id : undefined;
    if (teacherId && input.subject_id) {
      await assertTeacherSubjectAssignment(
        tx,
        schoolId,
        teacherId,
        input.subject_id,
        input.section_id
      );
    }

    await assertNoScheduleConflict(tx, schoolId, {
      section_id: input.section_id,
      exam_date: input.exam_date,
      start_time: input.start_time,
      duration_min: input.duration_min
    });

    const gradingRoles = await tx.grading_roles.findMany({
      where: { school_id: toBigInt(schoolId), is_active: true },
      select: { code: true, min_percentage: true, max_percentage: true }
    });
    const maxMarks = input.max_marks === undefined ? 100 : Number(input.max_marks);
    const passMark = (maxMarks * configuredPassPercentage(gradingRoles)) / 100;

    const created = await tx.exams.create({
      data: {
        school_id: toBigInt(schoolId),
        section_id: input.section_id ? toBigInt(input.section_id) : undefined,
        subject_id: toBigInt(input.subject_id),
        teacher_id: input.teacher_id ? toBigInt(input.teacher_id) : undefined,
        term_id: input.term_id ? toBigInt(input.term_id) : undefined,
        exam_type_id: input.exam_type_id ? toBigInt(input.exam_type_id) : undefined,
        name: input.name,
        type: input.type,
        exam_date: input.exam_date ? toDateValue(input.exam_date) : undefined,
        start_time: input.start_time ? parseStartTime(input.start_time) : undefined,
        duration_min: input.duration_min,
        max_marks: input.max_marks ? toDecimal(input.max_marks) : undefined,
        pass_mark: toDecimal(passMark),
        status: input.status
      }
    });

    return formatExam(created);
  });

export const findAllExams = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: ExamFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.examsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.section_id) where.section_id = toBigInt(filters.section_id);
  if (filters.subject_id) where.subject_id = toBigInt(filters.subject_id);
  if (filters.term_id) where.term_id = toBigInt(filters.term_id);
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.exams.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true, full_name: true } },
        teacher: { select: { id: true, name: true, email: true } },
        exam_type: { select: { id: true, name: true } },
        _count: { select: { exam_results: true } }
      }
    }),
    prisma.exams.count({ where })
  ]);

  const data = await Promise.all(
    items.map(async (item) => {
      let pass_rate: string | undefined;
      let average_score: string | undefined;
      let published_count = 0;

      if (item._count.exam_results > 0) {
        const results = await prisma.exam_results.findMany({
          where: { exam_id: item.id },
          select: { marks_obtained: true, is_absent: true, published_at: true }
        });

        published_count = results.filter((r) => r.published_at !== null).length;

        if (item.status === "completed") {
          const scored = results.filter((r) => !r.is_absent && r.marks_obtained !== null);
          const passMark = Number(item.pass_mark);

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
      }

      return {
        ...formatExam(item),
        subject: item.subject
          ? { ...item.subject, id: item.subject.id.toString() }
          : null,
        section: item.section
          ? { ...item.section, id: item.section.id.toString() }
          : null,
        teacher: item.teacher
          ? { ...item.teacher, id: item.teacher.id.toString() }
          : null,
        marked_count: item._count.exam_results,
        published_count,
        pass_rate,
        average_score
      };
    })
  );

  return {
    data,
    meta: { page, limit, total }
  };
};

export const findExamById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid exam id", 400);
  }

  const record = await prisma.exams.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      subject: true,
      section: true,
      teacher: {
        select: { id: true, name: true, email: true }
      },
      exam_type: { select: { id: true, name: true } }
    }
  });

  if (!record) {
    throw new AppError("not_found", "Exam not found", 404);
  }

  return {
    ...formatExam(record),
    subject: record.subject
      ? { ...record.subject, id: record.subject.id.toString() }
      : null,
    section: record.section
      ? { ...record.section, id: record.section.id.toString() }
      : null,
    teacher: record.teacher
      ? { ...record.teacher, id: record.teacher.id.toString() }
      : null
  };
};

export const updateExam = async (
  schoolId: string | number | bigint,
  id: string,
  input: ExamUpdateInput,
  actor?: Actor
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid exam id", 400);
    }

    const existing = await tx.exams.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Exam not found", 404);
    }

    await assertActorOwnsExam(tx, schoolId, existing, actor);

    if (existing.published_at && actor?.role === "teacher") {
      throw new AppError(
        "conflict",
        "Results are published and can no longer be edited. Ask your administrator to unpublish first.",
        409
      );
    }

    if (input.subject_id) {
      await assertSubject(tx, schoolId, input.subject_id);
    }

    if (input.section_id) {
      await assertSection(tx, schoolId, input.section_id);
    }

    if (input.teacher_id) {
      await assertTeacher(tx, schoolId, input.teacher_id);
    }
    if (input.exam_type_id) {
      const examType = await tx.exam_types.findFirst({
        where: { id: toBigInt(input.exam_type_id), school_id: toBigInt(schoolId), is_active: true }
      });
      if (!examType) throw new AppError("not_found", "Exam type not found", 404);
    }

    const sectionId =
      input.section_id !== undefined
        ? input.section_id
          ? toBigInt(input.section_id)
          : null
        : existing.section_id;
    const examDate =
      input.exam_date !== undefined
        ? input.exam_date
          ? toDateValue(input.exam_date)
          : null
        : existing.exam_date;
    const startTime =
      input.start_time !== undefined
        ? input.start_time
          ? parseStartTime(input.start_time)
          : null
        : existing.start_time;
    const durationMin =
      input.duration_min !== undefined ? input.duration_min : existing.duration_min;

    // A status/name/marks update must remain possible even if an old schedule
    // is already conflicting. Only validate when this request changes one of
    // the fields that determines the exam's schedule.
    const changesSchedule =
      input.section_id !== undefined ||
      input.exam_date !== undefined ||
      input.start_time !== undefined ||
      input.duration_min !== undefined;

    if (changesSchedule) {
      await assertNoScheduleConflict(tx, schoolId, {
        section_id: sectionId,
        exam_date: examDate,
        start_time: startTime,
        duration_min: durationMin,
        excludeExamId: existing.id
      });
    }

    const data: Prisma.examsUncheckedUpdateInput = {};
    if (input.section_id !== undefined) {
      data.section_id = input.section_id ? toBigInt(input.section_id) : null;
    }
    if (input.subject_id !== undefined) data.subject_id = toBigInt(input.subject_id);
    if (input.teacher_id !== undefined) {
      data.teacher_id = input.teacher_id ? toBigInt(input.teacher_id) : null;
    }
    if (input.exam_type_id !== undefined) {
      data.exam_type_id = input.exam_type_id ? toBigInt(input.exam_type_id) : null;
    }
    if (input.term_id !== undefined) {
      data.term_id = input.term_id ? toBigInt(input.term_id) : null;
    }
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.exam_date !== undefined) {
      data.exam_date = input.exam_date ? toDateValue(input.exam_date) : null;
    }
    if (input.start_time !== undefined) {
      data.start_time = input.start_time ? parseStartTime(input.start_time) : null;
    }
    if (input.duration_min !== undefined) data.duration_min = input.duration_min;
    if (input.max_marks !== undefined) data.max_marks = toDecimal(input.max_marks);
    if (input.pass_mark !== undefined) data.pass_mark = toDecimal(input.pass_mark);
    if (input.status !== undefined) data.status = input.status;

    const updated = await tx.exams.update({
      where: { id: existing.id },
      data
    });

    return formatExam(updated);
  });

export const deleteExam = async (
  schoolId: string | number | bigint,
  id: string,
  actor?: Actor
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid exam id", 400);
    }

    const existing = await tx.exams.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      },
      include: { _count: { select: { exam_results: true } } }
    });

    if (!existing) {
      throw new AppError("not_found", "Exam not found", 404);
    }

    await assertActorOwnsExam(tx, schoolId, existing, actor);

    if (existing._count.exam_results > 0) {
      throw new AppError("conflict", "Cannot delete exam with recorded results", 409);
    }

    await tx.exams.delete({ where: { id: existing.id } });

    return formatExam(existing);
  });
