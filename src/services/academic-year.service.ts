import type { Prisma, academic_years } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type AcademicYearCreateInput = {
  name: string;
  start_date: string | Date;
  end_date: string | Date;
  is_current?: boolean;
};

type AcademicYearUpdateInput = Partial<AcademicYearCreateInput>;

type AcademicYearFilters = {
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

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const formatAcademicYear = (year: academic_years) => ({
  ...year,
  id: year.id.toString(),
  school_id: year.school_id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "start_date", "end_date", "name"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.academic_yearsOrderByWithRelationInput;
  }

  return { start_date: "desc" } as Prisma.academic_yearsOrderByWithRelationInput;
};

export const createAcademicYear = async (
  schoolId: string | number | bigint,
  input: AcademicYearCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const existing = await tx.academic_years.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        name: input.name,
        deleted_at: null
      }
    });

    if (existing) {
      throw new AppError("conflict", "Academic year already exists", 409);
    }

    if (input.is_current) {
      await tx.academic_years.updateMany({
        where: {
          school_id: toBigInt(schoolId),
          deleted_at: null
        },
        data: { is_current: false }
      });
    }

    const created = await tx.academic_years.create({
      data: {
        school_id: toBigInt(schoolId),
        name: input.name,
        start_date: toDateValue(input.start_date),
        end_date: toDateValue(input.end_date),
        is_current: input.is_current ?? undefined
      }
    });

    return formatAcademicYear(created);
  });

export const findAllAcademicYears = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: AcademicYearFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.academic_yearsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.academic_years.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.academic_years.count({ where })
  ]);

  return {
    data: items.map((item) => formatAcademicYear(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findAcademicYearById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid academic year id", 400);
  }

  const year = await prisma.academic_years.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!year) {
    throw new AppError("not_found", "Academic year not found", 404);
  }

  return formatAcademicYear(year);
};

export const updateAcademicYear = async (
  schoolId: string | number | bigint,
  id: string,
  input: AcademicYearUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid academic year id", 400);
    }

    const existing = await tx.academic_years.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Academic year not found", 404);
    }

    if (input.name) {
      const nameInUse = await tx.academic_years.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          name: input.name,
          deleted_at: null,
          NOT: { id: existing.id }
        }
      });

      if (nameInUse) {
        throw new AppError("conflict", "Academic year already exists", 409);
      }
    }

    if (input.is_current) {
      await tx.academic_years.updateMany({
        where: {
          school_id: toBigInt(schoolId),
          deleted_at: null
        },
        data: { is_current: false }
      });
    }

    const data: Prisma.academic_yearsUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.start_date !== undefined) data.start_date = toDateValue(input.start_date);
    if (input.end_date !== undefined) data.end_date = toDateValue(input.end_date);
    if (input.is_current !== undefined) data.is_current = input.is_current;

    const updated = await tx.academic_years.update({
      where: { id: existing.id },
      data
    });

    return formatAcademicYear(updated);
  });

export const softDeleteAcademicYear = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid academic year id", 400);
    }

    const existing = await tx.academic_years.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Academic year not found", 404);
    }

    const deleted = await tx.academic_years.update({
      where: { id: existing.id },
      data: { deleted_at: new Date(), is_current: false }
    });

    return formatAcademicYear(deleted);
  });
