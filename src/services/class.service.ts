import type { Prisma, classes, school_levels } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type ClassCreateInput = {
  name: string;
  level?: number;
  level_id?: string | number | bigint | null;
  description?: string | null;
  academic_year_id?: string | number | bigint | null;
  combination_ids?: Array<string | number | bigint>;
};

type ClassUpdateInput = Partial<ClassCreateInput>;

type ClassFilters = {
  academic_year_id?: string | number | bigint;
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

const resolveAcademicYearId = (
  value: string | number | bigint | null | undefined
) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return toBigInt(value);
};

const formatClass = (record: classes & { class_combinations?: Array<{ combination: { id: bigint; code: string; name: string } }> }) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  academic_year_id: record.academic_year_id ? record.academic_year_id.toString() : null,
  level_id: record.level_id ? record.level_id.toString() : null,
  level_label: record.level_label ?? null,
  combinations: (record.class_combinations ?? []).map(({ combination }) => ({
    id: combination.id.toString(),
    code: combination.code,
    name: combination.name
  }))
});

const classInclude = {
  class_combinations: {
    include: { combination: { select: { id: true, code: true, name: true } } }
  }
} as const;

const assertCombinations = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  ids: Array<string | number | bigint>
) => {
  const combinationIds = ids.map(toBigInt);
  const rows = await tx.subject_combinations.findMany({
    where: { id: { in: combinationIds }, school_id: toBigInt(schoolId), deleted_at: null },
    select: { id: true }
  });
  if (rows.length !== new Set(combinationIds.map(String)).size) {
    throw new AppError("not_found", "One or more subject combinations were not found", 404);
  }
  return combinationIds;
};

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "name", "level", "level_label"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.classesOrderByWithRelationInput;
  }

  return { level: "asc" } as Prisma.classesOrderByWithRelationInput;
};

const resolveLevelRecord = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  input: Partial<ClassCreateInput>
) => {
  if (input.level_id !== undefined && input.level_id !== null) {
    return tx.school_levels.findFirst({
      where: {
        id: toBigInt(input.level_id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });
  }

  if (input.level !== undefined) {
    const byOrder = await tx.school_levels.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        sort_order: input.level,
        deleted_at: null
      }
    });

    if (byOrder) {
      return byOrder;
    }
  }

  if (input.name) {
    return tx.school_levels.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        label: input.name,
        deleted_at: null
      }
    });
  }

  return null;
};

export const createClass = async (
  schoolId: string | number | bigint,
  input: ClassCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const academicYearId = resolveAcademicYearId(input.academic_year_id);
    const levelRecord = await resolveLevelRecord(tx, schoolId, input);

    if (academicYearId) {
      const academicYear = await tx.academic_years.findFirst({
        where: {
          id: academicYearId,
          school_id: toBigInt(schoolId),
          deleted_at: null
        }
      });

      if (!academicYear) {
        throw new AppError("not_found", "Academic year not found", 404);
      }
    }

    if (!levelRecord) {
      throw new AppError("not_found", "Level not found", 404);
    }

    const duplicate = await tx.classes.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        name: input.name,
        academic_year_id: academicYearId ?? null,
        deleted_at: null
      }
    });

    if (duplicate) {
      throw new AppError("conflict", "Class already exists", 409);
    }

    const created = await tx.classes.create({
      data: {
        school_id: toBigInt(schoolId),
        academic_year_id: academicYearId ?? undefined,
        name: input.name,
        level_id: levelRecord.id,
        level: levelRecord.sort_order,
        level_label: levelRecord.label,
        description: input.description ?? null
      }
    });

    if (input.combination_ids?.length) {
      const combinationIds = await assertCombinations(tx, schoolId, input.combination_ids);
      await tx.class_combinations.createMany({
        data: combinationIds.map((combination_id) => ({
          school_id: toBigInt(schoolId), class_id: created.id, combination_id
        }))
      });
    }

    const withCombinations = await tx.classes.findUnique({ where: { id: created.id }, include: classInclude });
    return formatClass(withCombinations ?? created);
  });

export const findAllClasses = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: ClassFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.classesWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.academic_year_id) {
    where.academic_year_id = toBigInt(filters.academic_year_id);
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { level_label: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.classes.findMany({
      where,
      include: classInclude,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.classes.count({ where })
  ]);

  return {
    data: items.map((item) => formatClass(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findClassById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid class id", 400);
  }

  const record = await prisma.classes.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    include: classInclude
  });

  if (!record) {
    throw new AppError("not_found", "Class not found", 404);
  }

  return formatClass(record);
};

export const updateClass = async (
  schoolId: string | number | bigint,
  id: string,
  input: ClassUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid class id", 400);
    }

    const existing = await tx.classes.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Class not found", 404);
    }

    const academicYearId =
      input.academic_year_id !== undefined
        ? resolveAcademicYearId(input.academic_year_id)
        : existing.academic_year_id;
    const levelRecord = await resolveLevelRecord(tx, schoolId, input);

    if (input.academic_year_id !== undefined && academicYearId) {
      const academicYear = await tx.academic_years.findFirst({
        where: {
          id: academicYearId,
          school_id: toBigInt(schoolId),
          deleted_at: null
        }
      });

      if (!academicYear) {
        throw new AppError("not_found", "Academic year not found", 404);
      }
    }

    if ((input.level_id !== undefined || input.level !== undefined || input.name !== undefined) && !levelRecord) {
      throw new AppError("not_found", "Level not found", 404);
    }

    const nextLevelLabel = levelRecord?.label ?? existing.level_label ?? existing.name;
    const nextName = input.name ?? nextLevelLabel;

    if (input.name !== undefined || input.academic_year_id !== undefined || input.level_id !== undefined || input.level !== undefined) {
      const duplicate = await tx.classes.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          name: nextName,
          academic_year_id: academicYearId ?? null,
          deleted_at: null,
          NOT: { id: existing.id }
        }
      });

      if (duplicate) {
        throw new AppError("conflict", "Class already exists", 409);
      }
    }

    const data: Prisma.classesUncheckedUpdateInput = {};
    if (input.name !== undefined || levelRecord) data.name = nextName;
    if (levelRecord) {
      data.level_id = levelRecord.id;
      data.level = levelRecord.sort_order;
      data.level_label = levelRecord.label;
    } else if (input.level !== undefined) {
      data.level = input.level;
    }
    if (input.description !== undefined) data.description = input.description;
    if (input.academic_year_id !== undefined) {
      data.academic_year_id = academicYearId ?? null;
    }

    const updated = await tx.classes.update({
      where: { id: existing.id },
      data
    });

    if (input.combination_ids !== undefined) {
      const combinationIds = await assertCombinations(tx, schoolId, input.combination_ids);
      await tx.class_combinations.deleteMany({ where: { class_id: existing.id } });
      if (combinationIds.length) {
        await tx.class_combinations.createMany({
          data: combinationIds.map((combination_id) => ({
            school_id: toBigInt(schoolId), class_id: existing.id, combination_id
          }))
        });
      }
    }

    if (updated.name !== existing.name) {
      const sections = await tx.sections.findMany({
        where: {
          class_id: existing.id,
          deleted_at: null
        },
        select: { id: true, name: true }
      });

      await Promise.all(
        sections.map((section) =>
          tx.sections.update({
            where: { id: section.id },
            data: { full_name: `${updated.name} ${section.name}` }
          })
        )
      );
    }

    const withCombinations = await tx.classes.findUnique({ where: { id: existing.id }, include: classInclude });
    return formatClass(withCombinations ?? updated);
  });

export const softDeleteClass = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid class id", 400);
    }

    const existing = await tx.classes.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Class not found", 404);
    }

    const deleted = await tx.classes.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatClass(deleted);
  });
