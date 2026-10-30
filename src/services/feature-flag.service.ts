import { Prisma } from "@prisma/client";
import type { feature_flags } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatFeatureFlag = (record: feature_flags) => ({
  ...record,
  id: record.id.toString(),
  updated_by: record.updated_by ? record.updated_by.toString() : null
});

export type FeatureFlagCreateInput = {
  key_name: string;
  label: string;
  description?: string | null;
  is_enabled?: boolean;
  is_beta?: boolean;
};

export type FeatureFlagUpdateInput = Partial<FeatureFlagCreateInput>;

export const isFeatureEnabled = async (
  featureKey: string,
  schoolId?: string | number | bigint | null
) => {
  const flag = await prisma.feature_flags.findUnique({
    where: { key_name: featureKey }
  });

  if (!flag) {
    return false;
  }

  if (!flag.is_enabled) {
    return false;
  }

  if (schoolId) {
    const school = await prisma.schools.findFirst({
      where: { id: toBigInt(schoolId), deleted_at: null },
      select: { settings: true }
    });

    const settings = school?.settings;
    if (
      settings &&
      typeof settings === "object" &&
      !Array.isArray(settings) &&
      "feature_flags" in settings
    ) {
      const overrides = (settings as { feature_flags?: Record<string, boolean> })
        .feature_flags;
      if (overrides && featureKey in overrides) {
        return Boolean(overrides[featureKey]);
      }
    }
  }

  return true;
};

export const createFeatureFlag = async (
  input: FeatureFlagCreateInput,
  updatedBy?: string | number | bigint
) => {
  try {
    const record = await prisma.feature_flags.create({
      data: {
        key_name: input.key_name,
        label: input.label,
        description: input.description ?? null,
        is_enabled: input.is_enabled ?? false,
        is_beta: input.is_beta ?? false,
        updated_by: updatedBy ? toBigInt(updatedBy) : null
      }
    });

    return formatFeatureFlag(record);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("conflict", "Feature flag key already exists", 409);
    }

    throw error;
  }
};

export const findAllFeatureFlags = async (pagination: PaginationParams) => {
  const { page, limit } = pagination;

  const [items, total] = await prisma.$transaction([
    prisma.feature_flags.findMany({
      orderBy: { key_name: "asc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.feature_flags.count()
  ]);

  return {
    data: items.map(formatFeatureFlag),
    meta: { page, limit, total }
  };
};

export const findFeatureFlagById = async (id: string) => {
  const record = await prisma.feature_flags.findUnique({
    where: { id: toBigInt(id) }
  });

  if (!record) {
    throw new AppError("not_found", "Feature flag not found", 404);
  }

  return formatFeatureFlag(record);
};

export const findFeatureFlagByKey = async (keyName: string) => {
  const record = await prisma.feature_flags.findUnique({
    where: { key_name: keyName }
  });

  if (!record) {
    throw new AppError("not_found", "Feature flag not found", 404);
  }

  return formatFeatureFlag(record);
};

export const updateFeatureFlag = async (
  id: string,
  input: FeatureFlagUpdateInput,
  updatedBy?: string | number | bigint
) => {
  const existing = await prisma.feature_flags.findUnique({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Feature flag not found", 404);
  }

  const record = await prisma.feature_flags.update({
    where: { id: existing.id },
    data: {
      label: input.label ?? undefined,
      description: input.description !== undefined ? input.description : undefined,
      is_enabled: input.is_enabled ?? undefined,
      is_beta: input.is_beta ?? undefined,
      updated_by: updatedBy ? toBigInt(updatedBy) : undefined
    }
  });

  return formatFeatureFlag(record);
};

export const deleteFeatureFlag = async (id: string) => {
  const existing = await prisma.feature_flags.findUnique({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Feature flag not found", 404);
  }

  await prisma.feature_flags.delete({ where: { id: existing.id } });
  return formatFeatureFlag(existing);
};
