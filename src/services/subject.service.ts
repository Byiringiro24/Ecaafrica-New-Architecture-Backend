import type { Prisma } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type SubjectCreateInput = {
  name: string;
  code?: string | null;
  description?: string | null;
};

type SubjectUpdateInput = Partial<SubjectCreateInput> & {
  is_active?: boolean;
};

type SubjectFilters = {
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

type SubjectRecord = {
  id: bigint;
  school_id: bigint;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  deleted_at: Date | null;
};

const formatSubject = (record: SubjectRecord) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "name", "code"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Record<string, "asc" | "desc">;
  }

  return { created_at: "desc" } as Record<string, "asc" | "desc">;
};

export const createSubject = async (
  schoolId: string | number | bigint,
  input: SubjectCreateInput
) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.subjects.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        name: input.name,
        deleted_at: null
      }
    });

    if (existing) {
      throw new AppError("conflict", "Subject already exists", 409);
    }

    const created = await tx.subjects.create({
      data: {
        school_id: toBigInt(schoolId),
        name: input.name,
        code: input.code ?? null,
        description: input.description ?? null,
        is_active: false
      }
    });

    return formatSubject(created);
  });

export const findAllSubjects = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: SubjectFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Record<string, unknown> = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.subjects.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.subjects.count({ where })
  ]);

  return {
    data: items.map((item: SubjectRecord) => formatSubject(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findSubjectById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid subject id", 400);
  }

  const record = await prisma.subjects.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!record) {
    throw new AppError("not_found", "Subject not found", 404);
  }

  return formatSubject(record);
};

export const updateSubject = async (
  schoolId: string | number | bigint,
  id: string,
  input: SubjectUpdateInput
) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid subject id", 400);
    }

    const existing = await tx.subjects.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Subject not found", 404);
    }

    if (input.name) {
      const nameInUse = await tx.subjects.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          name: input.name,
          deleted_at: null,
          NOT: { id: existing.id }
        }
      });

      if (nameInUse) {
        throw new AppError("conflict", "Subject already exists", 409);
      }
    }

    const updated = await tx.subjects.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? undefined,
        code: input.code !== undefined ? input.code : undefined,
        description: input.description !== undefined ? input.description : undefined,
        is_active: input.is_active !== undefined ? input.is_active : undefined
      }
    });

    return formatSubject(updated);
  });

export const softDeleteSubject = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid subject id", 400);
    }

    const existing = await tx.subjects.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Subject not found", 404);
    }

    const deleted = await tx.subjects.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatSubject(deleted);
  });
