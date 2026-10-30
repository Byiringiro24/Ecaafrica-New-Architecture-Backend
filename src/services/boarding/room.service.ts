import type { Prisma, dorm_rooms } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

type DormRoomCreateInput = {
  dormitory_id: string | number | bigint;
  room_number: string;
  capacity?: number;
};

type DormRoomUpdateInput = {
  dormitory_id?: string | number | bigint;
  room_number?: string;
  capacity?: number;
};

type DormRoomFilters = {
  dormitory_id?: string | number | bigint;
  dormitory_ids?: bigint[];
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

type DormRoomWithUsage = dorm_rooms & {
  _count?: { student_dorm_assignments: number };
};

const formatDormRoom = (record: DormRoomWithUsage) => {
  const { _count, ...room } = record;
  return {
  ...room,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  dormitory_id: record.dormitory_id.toString(),
  occupied: _count?.student_dorm_assignments ?? 0,
  remaining_capacity: Math.max(
    record.capacity - (_count?.student_dorm_assignments ?? 0),
    0,
  ),
  };
};

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "room_number", "capacity"]);
  if (sort && allowed.has(sort)) {
    return {
      [sort]: order ?? "desc",
    } as Prisma.dorm_roomsOrderByWithRelationInput;
  }

  return { room_number: "asc" } as Prisma.dorm_roomsOrderByWithRelationInput;
};

const assertDormitory = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  dormitoryId: string | number | bigint,
) => {
  const dormitory = await tx.dormitories.findFirst({
    where: {
      id: toBigInt(dormitoryId),
      school_id: toBigInt(schoolId),
    },
  });

  if (!dormitory) {
    throw new AppError("not_found", "Dormitory not found", 404);
  }

  return dormitory;
};

export const createDormRoom = async (
  schoolId: string | number | bigint,
  input: DormRoomCreateInput,
) =>
  prisma.$transaction(async (tx) => {
    await assertDormitory(tx, schoolId, input.dormitory_id);

    const duplicate = await tx.dorm_rooms.findFirst({
      where: {
        dormitory_id: toBigInt(input.dormitory_id),
        room_number: input.room_number,
      },
    });

    if (duplicate) {
      throw new AppError("conflict", "Dorm room already exists", 409);
    }

    const created = await tx.dorm_rooms.create({
      data: {
        school_id: toBigInt(schoolId),
        dormitory_id: toBigInt(input.dormitory_id),
        room_number: input.room_number,
        capacity: input.capacity,
      },
    });

    return formatDormRoom(created);
  });

export const listDormRooms = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: DormRoomFilters = {},
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.dorm_roomsWhereInput = {
    school_id: toBigInt(schoolId),
  };

  if (filters.dormitory_id) {
    where.dormitory_id = toBigInt(filters.dormitory_id);
  }

  if (filters.dormitory_ids) {
    where.dormitory_id = { in: filters.dormitory_ids };
  }

  if (q) {
    where.OR = [{ room_number: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.dorm_rooms.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: {
            student_dorm_assignments: { where: { left_at: null } },
          },
        },
      },
    }),
    prisma.dorm_rooms.count({ where }),
  ]);

  return {
    data: items.map((item) => formatDormRoom(item)),
    meta: { page, limit, total },
  };
};

export const findDormRoomById = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid dorm room id", 400);
  }

  const record = await prisma.dorm_rooms.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
    include: {
      _count: {
        select: {
          student_dorm_assignments: { where: { left_at: null } },
        },
      },
    },
  });

  if (!record) {
    throw new AppError("not_found", "Dorm room not found", 404);
  }

  return formatDormRoom(record);
};

export const updateDormRoom = async (
  schoolId: string | number | bigint,
  id: string,
  input: DormRoomUpdateInput,
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid dorm room id", 400);
    }

    const existing = await tx.dorm_rooms.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
      },
    });

    if (!existing) {
      throw new AppError("not_found", "Dorm room not found", 404);
    }

    const dormitoryId = input.dormitory_id ?? existing.dormitory_id;
    if (input.dormitory_id) {
      await assertDormitory(tx, schoolId, input.dormitory_id);
    }

    if (input.room_number || input.dormitory_id) {
      const duplicate = await tx.dorm_rooms.findFirst({
        where: {
          dormitory_id: toBigInt(dormitoryId),
          room_number: input.room_number ?? existing.room_number,
          NOT: { id: existing.id },
        },
      });

      if (duplicate) {
        throw new AppError("conflict", "Dorm room already exists", 409);
      }
    }

    const updated = await tx.dorm_rooms.update({
      where: { id: existing.id },
      data: {
        dormitory_id: input.dormitory_id
          ? toBigInt(input.dormitory_id)
          : undefined,
        room_number: input.room_number,
        capacity: input.capacity,
      },
    });

    return formatDormRoom(updated);
  });

export const deleteDormRoom = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid dorm room id", 400);
  }

  const existing = await prisma.dorm_rooms.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!existing) {
    throw new AppError("not_found", "Dorm room not found", 404);
  }

  await prisma.dorm_rooms.delete({ where: { id: existing.id } });
  return formatDormRoom(existing);
};
