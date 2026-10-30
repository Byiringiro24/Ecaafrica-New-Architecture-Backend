import type { Prisma, dormitories } from "@prisma/client";
import { DormGender } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

type DormitoryCreateInput = {
  name: string;
  gender?: DormGender;
  capacity?: number;
  supervisor_id?: string | number | bigint;
  description?: string;
};

type DormitoryUpdateInput = {
  name?: string;
  gender?: DormGender;
  capacity?: number;
  supervisor_id?: string | number | bigint | null;
  description?: string | null;
};

type DormitoryFilters = {
  gender?: DormGender;
  dormitory_ids?: bigint[];
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatDormitory = (record: dormitories) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  supervisor_id: record.supervisor_id ? record.supervisor_id.toString() : null,
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "name", "capacity"]);
  if (sort && allowed.has(sort)) {
    return {
      [sort]: order ?? "desc",
    } as Prisma.dormitoriesOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.dormitoriesOrderByWithRelationInput;
};

const assertSupervisor = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  supervisorId: string | number | bigint,
) => {
  const supervisor = await tx.staff_profiles.findFirst({
    where: {
      id: toBigInt(supervisorId),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
  });

  if (!supervisor) {
    throw new AppError("not_found", "Supervisor not found", 404);
  }

  return supervisor;
};

export const createDormitory = async (
  schoolId: string | number | bigint,
  input: DormitoryCreateInput,
) =>
  prisma.$transaction(async (tx) => {
    if (input.supervisor_id) {
      await assertSupervisor(tx, schoolId, input.supervisor_id);
    }

    const duplicate = await tx.dormitories.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        name: input.name,
      },
    });

    if (duplicate) {
      throw new AppError("conflict", "Dormitory already exists", 409);
    }

    const created = await tx.dormitories.create({
      data: {
        school_id: toBigInt(schoolId),
        name: input.name,
        gender: input.gender,
        capacity: input.capacity,
        supervisor_id: input.supervisor_id
          ? toBigInt(input.supervisor_id)
          : undefined,
        description: input.description,
      },
    });

    return formatDormitory(created);
  });

export const listDormitories = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: DormitoryFilters = {},
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.dormitoriesWhereInput = {
    school_id: toBigInt(schoolId),
  };

  if (filters.gender) {
    where.gender = filters.gender;
  }

  if (filters.dormitory_ids) {
    where.id = { in: filters.dormitory_ids };
  }

  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.dormitories.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dormitories.count({ where }),
  ]);

  return {
    data: items.map((item) => formatDormitory(item)),
    meta: { page, limit, total },
  };
};

export const findDormitoryById = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid dormitory id", 400);
  }

  const record = await prisma.dormitories.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!record) {
    throw new AppError("not_found", "Dormitory not found", 404);
  }

  return formatDormitory(record);
};

export const updateDormitory = async (
  schoolId: string | number | bigint,
  id: string,
  input: DormitoryUpdateInput,
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid dormitory id", 400);
    }

    const existing = await tx.dormitories.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
      },
    });

    if (!existing) {
      throw new AppError("not_found", "Dormitory not found", 404);
    }

    if (input.supervisor_id) {
      await assertSupervisor(tx, schoolId, input.supervisor_id);
    }

    if (input.name) {
      const duplicate = await tx.dormitories.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          name: input.name,
          NOT: { id: existing.id },
        },
      });

      if (duplicate) {
        throw new AppError("conflict", "Dormitory name already exists", 409);
      }
    }

    const updated = await tx.dormitories.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        gender: input.gender,
        capacity: input.capacity,
        supervisor_id:
          input.supervisor_id === undefined
            ? undefined
            : input.supervisor_id
              ? toBigInt(input.supervisor_id)
              : null,
        description: input.description,
      },
    });

    return formatDormitory(updated);
  });

export const deleteDormitory = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid dormitory id", 400);
  }

  const existing = await prisma.dormitories.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!existing) {
    throw new AppError("not_found", "Dormitory not found", 404);
  }

  await prisma.dormitories.delete({ where: { id: existing.id } });
  return formatDormitory(existing);
};
