import type { Prisma, terms } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type TermCreateInput = {
  academic_year_id: string | number | bigint;
  name: string;
  start_date: string | Date;
  end_date: string | Date;
  is_current?: boolean;
};

type TermUpdateInput = Partial<TermCreateInput>;

type TermFilters = {
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

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const formatTerm = (term: terms) => ({
  ...term,
  id: term.id.toString(),
  school_id: term.school_id.toString(),
  academic_year_id: term.academic_year_id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "start_date", "end_date", "name"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.termsOrderByWithRelationInput;
  }

  return { start_date: "desc" } as Prisma.termsOrderByWithRelationInput;
};

export const createTerm = async (
  schoolId: string | number | bigint,
  input: TermCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const academicYear = await tx.academic_years.findFirst({
      where: {
        id: toBigInt(input.academic_year_id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!academicYear) {
      throw new AppError("not_found", "Academic year not found", 404);
    }

    if (input.is_current) {
      await tx.terms.updateMany({
        where: {
          school_id: toBigInt(schoolId),
          academic_year_id: academicYear.id,
          deleted_at: null
        },
        data: { is_current: false }
      });
    }

    const created = await tx.terms.create({
      data: {
        school_id: toBigInt(schoolId),
        academic_year_id: academicYear.id,
        name: input.name,
        start_date: toDateValue(input.start_date),
        end_date: toDateValue(input.end_date),
        is_current: input.is_current ?? undefined
      }
    });

    return formatTerm(created);
  });

export const findAllTerms = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: TermFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.termsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.academic_year_id) {
    where.academic_year_id = toBigInt(filters.academic_year_id);
  }

  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.terms.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.terms.count({ where })
  ]);

  return {
    data: items.map((item) => formatTerm(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findTermById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid term id", 400);
  }

  const term = await prisma.terms.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!term) {
    throw new AppError("not_found", "Term not found", 404);
  }

  return formatTerm(term);
};

export const updateTerm = async (
  schoolId: string | number | bigint,
  id: string,
  input: TermUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid term id", 400);
    }

    const existing = await tx.terms.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Term not found", 404);
    }

    const academicYearId =
      input.academic_year_id !== undefined
        ? toBigInt(input.academic_year_id)
        : existing.academic_year_id;

    if (input.academic_year_id !== undefined) {
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

    if (input.is_current) {
      await tx.terms.updateMany({
        where: {
          school_id: toBigInt(schoolId),
          academic_year_id: academicYearId,
          deleted_at: null
        },
        data: { is_current: false }
      });
    }

    const data: Prisma.termsUpdateInput = {};
    if (input.academic_year_id !== undefined) {
      data.academic_year = { connect: { id: academicYearId } };
    }
    if (input.name !== undefined) data.name = input.name;
    if (input.start_date !== undefined) data.start_date = toDateValue(input.start_date);
    if (input.end_date !== undefined) data.end_date = toDateValue(input.end_date);
    if (input.is_current !== undefined) data.is_current = input.is_current;

    const updated = await tx.terms.update({
      where: { id: existing.id },
      data
    });

    return formatTerm(updated);
  });

export const softDeleteTerm = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid term id", 400);
    }

    const existing = await tx.terms.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Term not found", 404);
    }

    const deleted = await tx.terms.update({
      where: { id: existing.id },
      data: { deleted_at: new Date(), is_current: false }
    });

    return formatTerm(deleted);
  });
