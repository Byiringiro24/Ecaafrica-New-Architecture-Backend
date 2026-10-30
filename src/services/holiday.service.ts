import type { HolidayType, Prisma, holidays } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type HolidayCreateInput = {
  name: string;
  start_date: string | Date;
  end_date: string | Date;
  type?: string;
};

type HolidayUpdateInput = Partial<HolidayCreateInput>;

type HolidayFilters = {
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

const formatHoliday = (record: holidays) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "start_date", "end_date", "name"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.holidaysOrderByWithRelationInput;
  }

  return { start_date: "desc" } as Prisma.holidaysOrderByWithRelationInput;
};

export const createHoliday = async (
  schoolId: string | number | bigint,
  input: HolidayCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const created = await tx.holidays.create({
      data: {
        school_id: toBigInt(schoolId),
        name: input.name,
        start_date: toDateValue(input.start_date),
        end_date: toDateValue(input.end_date),
        type: input.type ? (input.type as HolidayType) : undefined
      }
    });

    return formatHoliday(created);
  });

export const findAllHolidays = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: HolidayFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.holidaysWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.holidays.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.holidays.count({ where })
  ]);

  return {
    data: items.map((item) => formatHoliday(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findHolidayById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid holiday id", 400);
  }

  const record = await prisma.holidays.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!record) {
    throw new AppError("not_found", "Holiday not found", 404);
  }

  return formatHoliday(record);
};

export const updateHoliday = async (
  schoolId: string | number | bigint,
  id: string,
  input: HolidayUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid holiday id", 400);
    }

    const existing = await tx.holidays.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Holiday not found", 404);
    }

    const data: Prisma.holidaysUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.start_date !== undefined) data.start_date = toDateValue(input.start_date);
    if (input.end_date !== undefined) data.end_date = toDateValue(input.end_date);
    if (input.type !== undefined) data.type = input.type as HolidayType;

    const updated = await tx.holidays.update({
      where: { id: existing.id },
      data
    });

    return formatHoliday(updated);
  });

export const softDeleteHoliday = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid holiday id", 400);
    }

    const existing = await tx.holidays.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Holiday not found", 404);
    }

    const deleted = await tx.holidays.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatHoliday(deleted);
  });
