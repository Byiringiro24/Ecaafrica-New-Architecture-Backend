import { Prisma, type system_settings } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";
import { SystemSettingType } from "../constants/enums";

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatSetting = (record: system_settings) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id ? record.school_id.toString() : null,
  updated_by: record.updated_by ? record.updated_by.toString() : null
});

const parseStoredValue = (value: string | null, type: string) => {
  if (value === null) return null;

  switch (type) {
    case SystemSettingType.INTEGER:
      return Number.parseInt(value, 10);
    case SystemSettingType.BOOLEAN:
      return value === "true";
    case SystemSettingType.JSON:
      return JSON.parse(value);
    default:
      return value;
  }
};

const serializeValue = (value: unknown, type: string) => {
  if (value === null || value === undefined) return null;

  switch (type) {
    case SystemSettingType.INTEGER:
      return String(value);
    case SystemSettingType.BOOLEAN:
      return value === true || value === "true" ? "true" : "false";
    case SystemSettingType.JSON:
      return typeof value === "string" ? value : JSON.stringify(value);
    default:
      return String(value);
  }
};

export type SystemSettingCreateInput = {
  key_name: string;
  value?: unknown;
  type?: string;
};

export type SystemSettingUpdateInput = {
  value?: unknown;
  type?: string;
};

export const getSettingByKey = async (
  keyName: string,
  schoolId?: string | number | bigint | null
) => {
  const record = await prisma.system_settings.findFirst({
    where: {
      key_name: keyName,
      school_id:
        schoolId !== undefined && schoolId !== null ? toBigInt(schoolId) : null
    }
  });

  if (!record) {
    throw new AppError("not_found", "System setting not found", 404);
  }

  return {
    ...formatSetting(record),
    parsed_value: parseStoredValue(record.value, record.type)
  };
};

export const createSetting = async (
  input: SystemSettingCreateInput,
  schoolId?: string | number | bigint | null,
  updatedBy?: string | number | bigint
) => {
  const type = (input.type ?? SystemSettingType.STRING) as system_settings["type"];

  try {
    const record = await prisma.system_settings.create({
      data: {
        school_id:
          schoolId !== undefined && schoolId !== null ? toBigInt(schoolId) : null,
        key_name: input.key_name,
        value: serializeValue(input.value, type),
        type,
        updated_by: updatedBy ? toBigInt(updatedBy) : null
      }
    });

    return {
      ...formatSetting(record),
      parsed_value: parseStoredValue(record.value, record.type)
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("conflict", "Setting key already exists", 409);
    }

    throw error;
  }
};

export const findAllSettings = async (
  pagination: PaginationParams,
  schoolId?: string | number | bigint | null
) => {
  const { page, limit, q } = pagination;
  const where: Prisma.system_settingsWhereInput = {
    school_id:
      schoolId !== undefined && schoolId !== null ? toBigInt(schoolId) : null
  };

  if (q) {
    where.key_name = { contains: q, mode: "insensitive" };
  }

  const [items, total] = await prisma.$transaction([
    prisma.system_settings.findMany({
      where,
      orderBy: { key_name: "asc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.system_settings.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatSetting(item),
      parsed_value: parseStoredValue(item.value, item.type)
    })),
    meta: { page, limit, total }
  };
};

export const findSettingById = async (
  id: string,
  schoolId?: string | number | bigint | null
) => {
  const record = await prisma.system_settings.findFirst({
    where: {
      id: toBigInt(id),
      school_id:
        schoolId !== undefined && schoolId !== null ? toBigInt(schoolId) : null
    }
  });

  if (!record) {
    throw new AppError("not_found", "System setting not found", 404);
  }

  return {
    ...formatSetting(record),
    parsed_value: parseStoredValue(record.value, record.type)
  };
};

export const updateSetting = async (
  keyName: string,
  input: SystemSettingUpdateInput,
  schoolId?: string | number | bigint | null,
  updatedBy?: string | number | bigint
) => {
  const existing = await prisma.system_settings.findFirst({
    where: {
      key_name: keyName,
      school_id:
        schoolId !== undefined && schoolId !== null ? toBigInt(schoolId) : null
    }
  });

  if (!existing) {
    throw new AppError("not_found", "System setting not found", 404);
  }

  const type = (input.type ?? existing.type) as system_settings["type"];
  const value =
    input.value !== undefined
      ? serializeValue(input.value, type)
      : existing.value;

  const record = await prisma.system_settings.update({
    where: { id: existing.id },
    data: {
      value,
      type: input.type ? type : undefined,
      updated_by: updatedBy ? toBigInt(updatedBy) : undefined
    }
  });

  return {
    ...formatSetting(record),
    parsed_value: parseStoredValue(record.value, record.type)
  };
};

export const updateSettingById = async (
  id: string,
  input: SystemSettingUpdateInput,
  schoolId?: string | number | bigint | null,
  updatedBy?: string | number | bigint
) => {
  const existing = await prisma.system_settings.findFirst({
    where: {
      id: toBigInt(id),
      school_id:
        schoolId !== undefined && schoolId !== null ? toBigInt(schoolId) : null
    }
  });

  if (!existing) {
    throw new AppError("not_found", "System setting not found", 404);
  }

  return updateSetting(existing.key_name, input, schoolId, updatedBy);
};

export const deleteSetting = async (
  id: string,
  schoolId?: string | number | bigint | null
) => {
  const existing = await prisma.system_settings.findFirst({
    where: {
      id: toBigInt(id),
      school_id:
        schoolId !== undefined && schoolId !== null ? toBigInt(schoolId) : null
    }
  });

  if (!existing) {
    throw new AppError("not_found", "System setting not found", 404);
  }

  await prisma.system_settings.delete({ where: { id: existing.id } });
  return {
    ...formatSetting(existing),
    parsed_value: parseStoredValue(existing.value, existing.type)
  };
};
