import type { Prisma, school_levels } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type LevelCreateInput = {
  label: string;
  sort_order?: number;
  is_active?: boolean;
};

type LevelUpdateInput = Partial<LevelCreateInput>;

type LevelFilters = {
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

const formatLevel = (record: school_levels) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "label", "sort_order"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "asc" } as Prisma.school_levelsOrderByWithRelationInput;
  }

  return { sort_order: "asc" } as Prisma.school_levelsOrderByWithRelationInput;
};

export const createLevel = async (
  schoolId: string | number | bigint,
  input: LevelCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const duplicate = await tx.school_levels.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        label: input.label,
        deleted_at: null
      }
    });

    if (duplicate) {
      throw new AppError("conflict", "Level already exists", 409);
    }

    const lastLevel = await tx.school_levels.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        deleted_at: null
      },
      orderBy: { sort_order: "desc" },
      select: { sort_order: true }
    });

    const created = await tx.school_levels.create({
      data: {
        school_id: toBigInt(schoolId),
        label: input.label,
        sort_order: input.sort_order ?? ((lastLevel?.sort_order ?? 0) + 1),
        is_active: input.is_active ?? true
      }
    });

    return formatLevel(created);
  });

export const findAllLevels = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: LevelFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.school_levelsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (q) {
    where.label = { contains: q, mode: "insensitive" };
  }

  const [items, total] = await prisma.$transaction([
    prisma.school_levels.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.school_levels.count({ where })
  ]);

  return {
    data: items.map((item) => formatLevel(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findLevelById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid level id", 400);
  }

  const record = await prisma.school_levels.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!record) {
    throw new AppError("not_found", "Level not found", 404);
  }

  return formatLevel(record);
};

export const updateLevel = async (
  schoolId: string | number | bigint,
  id: string,
  input: LevelUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid level id", 400);
    }

    const existing = await tx.school_levels.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Level not found", 404);
    }

    if (input.label !== undefined) {
      const duplicate = await tx.school_levels.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          label: input.label,
          deleted_at: null,
          NOT: { id: existing.id }
        }
      });

      if (duplicate) {
        throw new AppError("conflict", "Level already exists", 409);
      }
    }

    const updated = await tx.school_levels.update({
      where: { id: existing.id },
      data: {
        label: input.label,
        sort_order: input.sort_order,
        is_active: input.is_active
      }
    });

    return formatLevel(updated);
  });

export const softDeleteLevel = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid level id", 400);
    }

    const existing = await tx.school_levels.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Level not found", 404);
    }

    const deleted = await tx.school_levels.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatLevel(deleted);
  });
