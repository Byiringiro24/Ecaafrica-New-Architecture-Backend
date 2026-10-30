import type { Prisma, teacher_section_subjects } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type TeacherSectionSubjectCreateInput = {
  teacher_id: string | number | bigint;
  section_id: string | number | bigint;
  subject_id: string | number | bigint;
  term_id?: string | number | bigint;
};

type TeacherSectionSubjectUpdateInput = Partial<TeacherSectionSubjectCreateInput>;

type TeacherSectionSubjectFilters = {
  teacher_id?: string | number | bigint;
  section_id?: string | number | bigint;
  subject_id?: string | number | bigint;
  term_id?: string | number | bigint;
  include_deleted?: boolean;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value);
};

const formatTeacherSectionSubject = (record: teacher_section_subjects) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  teacher_id: record.teacher_id.toString(),
  section_id: record.section_id.toString(),
  subject_id: record.subject_id.toString(),
  term_id: record.term_id ? record.term_id.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.teacher_section_subjectsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.teacher_section_subjectsOrderByWithRelationInput;
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
      OR: [
        { role: "teacher" },
        {
          user_roles: {
            some: {
              school_id: toBigInt(schoolId),
              role: { slug: "teacher", deleted_at: null },
            },
          },
        },
      ],
      deleted_at: null
    }
  });

  if (!teacher) {
    throw new AppError("not_found", "Teacher not found", 404);
  }

  return teacher;
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

  if (!subject.is_active) {
    throw new AppError("conflict", "Subject must be active before it can be assigned", 409);
  }

  return subject;
};

const assertTerm = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  termId: string | number | bigint
) => {
  const term = await tx.terms.findFirst({
    where: {
      id: toBigInt(termId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!term) {
    throw new AppError("not_found", "Term not found", 404);
  }

  return term;
};

export const createTeacherSectionSubject = async (
  schoolId: string | number | bigint,
  input: TeacherSectionSubjectCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const teacher = await assertTeacher(tx, schoolId, input.teacher_id);
    const section = await assertSection(tx, schoolId, input.section_id);
    const subject = await assertSubject(tx, schoolId, input.subject_id);
    const termId = input.term_id ? toBigInt(input.term_id) : null;

    if (input.term_id) {
      await assertTerm(tx, schoolId, input.term_id);
    }

    const duplicate = await tx.teacher_section_subjects.findFirst({
      where: {
        teacher_id: teacher.id,
        section_id: section.id,
        subject_id: subject.id,
        term_id: termId,
        deleted_at: null
      }
    });

    if (duplicate) {
      throw new AppError("conflict", "Assignment already exists", 409);
    }

    const created = await tx.teacher_section_subjects.create({
      data: {
        school_id: toBigInt(schoolId),
        teacher_id: teacher.id,
        section_id: section.id,
        subject_id: subject.id,
        term_id: termId ?? undefined
      }
    });

    return formatTeacherSectionSubject(created);
  });

export const findAllTeacherSectionSubjects = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: TeacherSectionSubjectFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.teacher_section_subjectsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.teacher_id) where.teacher_id = toBigInt(filters.teacher_id);
  if (filters.section_id) where.section_id = toBigInt(filters.section_id);
  if (filters.subject_id) where.subject_id = toBigInt(filters.subject_id);
  if (filters.term_id) where.term_id = toBigInt(filters.term_id);

  const [items, total] = await prisma.$transaction([
    prisma.teacher_section_subjects.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.teacher_section_subjects.count({ where })
  ]);

  return {
    data: items.map((item) => formatTeacherSectionSubject(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findTeacherSectionSubjectById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid assignment id", 400);
  }

  const record = await prisma.teacher_section_subjects.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!record) {
    throw new AppError("not_found", "Assignment not found", 404);
  }

  return formatTeacherSectionSubject(record);
};

export const updateTeacherSectionSubject = async (
  schoolId: string | number | bigint,
  id: string,
  input: TeacherSectionSubjectUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid assignment id", 400);
    }

    const existing = await tx.teacher_section_subjects.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Assignment not found", 404);
    }

    const teacherId = input.teacher_id ? toBigInt(input.teacher_id) : existing.teacher_id;
    const sectionId = input.section_id ? toBigInt(input.section_id) : existing.section_id;
    const subjectId = input.subject_id ? toBigInt(input.subject_id) : existing.subject_id;
    const termId = input.term_id ? toBigInt(input.term_id) : existing.term_id;

    if (input.teacher_id) {
      await assertTeacher(tx, schoolId, input.teacher_id);
    }
    if (input.section_id) {
      await assertSection(tx, schoolId, input.section_id);
    }
    if (input.subject_id) {
      await assertSubject(tx, schoolId, input.subject_id);
    }
    if (input.term_id) {
      await assertTerm(tx, schoolId, input.term_id);
    }

    const duplicate = await tx.teacher_section_subjects.findFirst({
      where: {
        teacher_id: teacherId,
        section_id: sectionId,
        subject_id: subjectId,
        term_id: termId,
        deleted_at: null,
        NOT: { id: existing.id }
      }
    });

    if (duplicate) {
      throw new AppError("conflict", "Assignment already exists", 409);
    }

    const updated = await tx.teacher_section_subjects.update({
      where: { id: existing.id },
      data: {
        teacher_id: teacherId,
        section_id: sectionId,
        subject_id: subjectId,
        term_id: termId ?? undefined
      }
    });

    return formatTeacherSectionSubject(updated);
  });

export const softDeleteTeacherSectionSubject = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid assignment id", 400);
    }

    const existing = await tx.teacher_section_subjects.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Assignment not found", 404);
    }

    const deleted = await tx.teacher_section_subjects.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatTeacherSectionSubject(deleted);
  });
