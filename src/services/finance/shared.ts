import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";

export type IdInput = string | number | bigint;

export const toBigInt = (value: IdInput) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

export const parseId = (id: string, label: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", `Invalid ${label} id`, 400);
  }

  return BigInt(id);
};

export const toDecimal = (value: string | number) =>
  typeof value === "string" ? value : value.toString();

export const toDate = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

export const decimalToString = (value: Prisma.Decimal | null) =>
  value === null ? null : value.toString();

export const toAuditJson = (
  input: Record<string, unknown>
): Prisma.InputJsonObject => {
  const entries: [string, Prisma.InputJsonValue][] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    if (typeof value === "bigint") {
      entries.push([key, value.toString()]);
      continue;
    }

    if (value instanceof Date) {
      entries.push([key, value.toISOString()]);
      continue;
    }

    entries.push([key, value as Prisma.InputJsonValue]);
  }

  return Object.fromEntries(entries) as Prisma.InputJsonObject;
};

export const resolveOrderBy = <T>(
  allowed: string[],
  sort: string | undefined,
  order: "asc" | "desc" | undefined,
  fallback: string
): T => {
  const column = sort && allowed.includes(sort) ? sort : fallback;
  return { [column]: order ?? "desc" } as T;
};

/**
 * Sequence-style reference generator (EXP-2026-0001). Runs inside the caller's
 * transaction so the count and the insert cannot interleave with a concurrent
 * request and produce a duplicate.
 */
export const nextReference = async (
  prefix: string,
  year: number,
  currentCount: number,
  width = 4
) => `${prefix}-${year}-${String(currentCount + 1).padStart(width, "0")}`;

export const dateRangeFilter = (from?: string, to?: string) => {
  if (!from && !to) return undefined;

  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = toDate(from);
  if (to) range.lte = toDate(to);
  return range;
};
