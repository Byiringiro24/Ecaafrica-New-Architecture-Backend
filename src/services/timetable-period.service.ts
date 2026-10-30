import type { Prisma, timetable_periods } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type TimetablePeriodCreateInput = {
  name: string;
  start_time: string | Date;
  end_time: string | Date;
  is_break?: boolean;
  sort_order?: number;
};

type TimetablePeriodUpdateInput = Partial<TimetablePeriodCreateInput>;

type TimetablePeriodFilters = {
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

const parseTimeValue = (value: string | Date, fieldName: "start_time" | "end_time") => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new AppError("bad_request", `Invalid ${fieldName} value`, 400);
    }
    return value;
  }

  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] ? Number(match[3]) : 0;

    if (hours > 23 || minutes > 59 || seconds > 59) {
      throw new AppError("bad_request", `Invalid ${fieldName} format (use HH:mm)`, 400);
    }

    return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("bad_request", `Invalid ${fieldName} format (use HH:mm)`, 400);
  }

  return date;
};

const toClockString = (value: Date) =>
  `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;

const formatTimetablePeriod = (record: timetable_periods) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  start_time: toClockString(record.start_time),
  end_time: toClockString(record.end_time)
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["name", "sort_order"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "asc" } as Prisma.timetable_periodsOrderByWithRelationInput;
  }

  return { sort_order: "asc" } as Prisma.timetable_periodsOrderByWithRelationInput;
};

export const createTimetablePeriod = async (
  schoolId: string | number | bigint,
  input: TimetablePeriodCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const created = await tx.timetable_periods.create({
      data: {
        school_id: toBigInt(schoolId),
        name: input.name,
        start_time: parseTimeValue(input.start_time, "start_time"),
        end_time: parseTimeValue(input.end_time, "end_time"),
        is_break: input.is_break ?? undefined,
        sort_order: input.sort_order ?? undefined
      }
    });

    return formatTimetablePeriod(created);
  });

export const findAllTimetablePeriods = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: TimetablePeriodFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.timetable_periodsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.timetable_periods.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.timetable_periods.count({ where })
  ]);

  return {
    data: items.map((item) => formatTimetablePeriod(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findTimetablePeriodById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid period id", 400);
  }

  const record = await prisma.timetable_periods.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!record) {
    throw new AppError("not_found", "Period not found", 404);
  }

  return formatTimetablePeriod(record);
};

export const updateTimetablePeriod = async (
  schoolId: string | number | bigint,
  id: string,
  input: TimetablePeriodUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid period id", 400);
    }

    const existing = await tx.timetable_periods.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Period not found", 404);
    }

    const data: Prisma.timetable_periodsUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.start_time !== undefined) {
      data.start_time = parseTimeValue(input.start_time, "start_time");
    }
    if (input.end_time !== undefined) {
      data.end_time = parseTimeValue(input.end_time, "end_time");
    }
    if (input.is_break !== undefined) data.is_break = input.is_break;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;

    const updated = await tx.timetable_periods.update({
      where: { id: existing.id },
      data
    });

    return formatTimetablePeriod(updated);
  });

export const softDeleteTimetablePeriod = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid period id", 400);
    }

    const existing = await tx.timetable_periods.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Period not found", 404);
    }

    const deleted = await tx.timetable_periods.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatTimetablePeriod(deleted);
  });
