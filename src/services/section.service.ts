import type { Prisma, sections } from "@prisma/client";
import { UserRole } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type SectionCreateInput = {
  class_id: string | number | bigint;
  name: string;
  full_name: string;
  class_teacher_id?: string | number | bigint;
  capacity?: number;
  room?: string | null;
};

type SectionUpdateInput = Partial<SectionCreateInput>;

type SectionFilters = {
  class_id?: string | number | bigint;
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

const formatSection = (record: sections) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  class_id: record.class_id.toString(),
  class_teacher_id: record.class_teacher_id ? record.class_teacher_id.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "name", "full_name", "capacity"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.sectionsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.sectionsOrderByWithRelationInput;
};

const assertClassTeacher = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  teacherId: string | number | bigint
) => {
  const teacher = await tx.users.findFirst({
    where: {
      id: toBigInt(teacherId),
      school_id: toBigInt(schoolId),
      role: UserRole.teacher,
      deleted_at: null
    }
  });

  if (!teacher) {
    throw new AppError("not_found", "Teacher not found", 404);
  }
};

export const createSection = async (
  schoolId: string | number | bigint,
  input: SectionCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const classRecord = await tx.classes.findFirst({
      where: {
        id: toBigInt(input.class_id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!classRecord) {
      throw new AppError("not_found", "Class not found", 404);
    }

    if (input.class_teacher_id) {
      await assertClassTeacher(tx, schoolId, input.class_teacher_id);
    }

    const duplicate = await tx.sections.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        class_id: classRecord.id,
        name: input.name,
        deleted_at: null
      }
    });

    if (duplicate) {
      throw new AppError("conflict", "Section already exists", 409);
    }

    const created = await tx.sections.create({
      data: {
        school_id: toBigInt(schoolId),
        class_id: classRecord.id,
        name: input.name,
        full_name: input.full_name,
        class_teacher_id: input.class_teacher_id
          ? toBigInt(input.class_teacher_id)
          : undefined,
        capacity: input.capacity ?? undefined,
        room: input.room ?? null
      }
    });

    return formatSection(created);
  });

export const findAllSections = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: SectionFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.sectionsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.class_id) {
    where.class_id = toBigInt(filters.class_id);
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { full_name: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.sections.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.sections.count({ where })
  ]);

  return {
    data: items.map((item) => formatSection(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findSectionById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid section id", 400);
  }

  const record = await prisma.sections.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!record) {
    throw new AppError("not_found", "Section not found", 404);
  }

  return formatSection(record);
};

export const updateSection = async (
  schoolId: string | number | bigint,
  id: string,
  input: SectionUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid section id", 400);
    }

    const existing = await tx.sections.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Section not found", 404);
    }

    const classId = input.class_id ? toBigInt(input.class_id) : existing.class_id;

    if (input.class_id) {
      const classRecord = await tx.classes.findFirst({
        where: {
          id: classId,
          school_id: toBigInt(schoolId),
          deleted_at: null
        }
      });

      if (!classRecord) {
        throw new AppError("not_found", "Class not found", 404);
      }
    }

    if (input.class_teacher_id) {
      await assertClassTeacher(tx, schoolId, input.class_teacher_id);
    }

    if (input.name !== undefined || input.class_id !== undefined) {
      const duplicate = await tx.sections.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          class_id: classId,
          name: input.name ?? existing.name,
          deleted_at: null,
          NOT: { id: existing.id }
        }
      });

      if (duplicate) {
        throw new AppError("conflict", "Section already exists", 409);
      }
    }

    const data: Prisma.sectionsUpdateInput = {};
    if (input.class_id !== undefined) {
      data.class = { connect: { id: classId } };
    }
    if (input.name !== undefined) data.name = input.name;
    if (input.full_name !== undefined) data.full_name = input.full_name;
    if (input.class_teacher_id !== undefined) {
      data.class_teacher = input.class_teacher_id
        ? { connect: { id: toBigInt(input.class_teacher_id) } }
        : { disconnect: true };
    }
    if (input.capacity !== undefined) data.capacity = input.capacity;
    if (input.room !== undefined) data.room = input.room;

    const updated = await tx.sections.update({
      where: { id: existing.id },
      data
    });

    return formatSection(updated);
  });

export const softDeleteSection = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid section id", 400);
    }

    const existing = await tx.sections.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Section not found", 404);
    }

    const deleted = await tx.sections.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatSection(deleted);
  });
