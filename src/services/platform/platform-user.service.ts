import { v4 as uuidv4 } from "uuid";
import type {
  PlatformUserAccessScope,
  PlatformUserRole,
  PlatformUserStatus,
  Prisma,
  platform_users
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { hashPassword } from "../../utils/hash";

type PlatformUserCreateInput = {
  name: string;
  email: string;
  password: string;
  role?: string;
  access_scope?: string;
  permissions?: Prisma.InputJsonValue | null;
  status?: string;
};

type PlatformUserUpdateInput = Partial<PlatformUserCreateInput> & {
  password?: string;
};

type PlatformUserFilters = {
  status?: string;
  role?: string;
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

const platformUserSelect = {
  id: true,
  uuid: true,
  name: true,
  email: true,
  role: true,
  access_scope: true,
  permissions: true,
  status: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true
} satisfies Prisma.platform_usersSelect;

type PlatformUserRecord = Pick<platform_users,
  "id" | "uuid" | "name" | "email" | "role" | "access_scope" | "permissions" | "status" |
  "last_login_at" | "created_at" | "updated_at" | "deleted_at"
>;

const formatPlatformUser = (user: PlatformUserRecord) => ({
  ...user,
  id: user.id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "name", "status"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.platform_usersOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.platform_usersOrderByWithRelationInput;
};

export const createPlatformUser = async (input: PlatformUserCreateInput) => {
  const existing = await prisma.platform_users.findFirst({
    where: { email: input.email, deleted_at: null }
  });

  if (existing) {
    throw new AppError("conflict", "Email already in use", 409);
  }

  const password_hash = await hashPassword(input.password);
  const created = await prisma.platform_users.create({
    data: {
      uuid: uuidv4(),
      name: input.name,
      email: input.email,
      password_hash,
      role: (input.role as PlatformUserRole) ?? undefined,
      access_scope: (input.access_scope as PlatformUserAccessScope) ?? undefined,
      permissions: input.permissions ?? undefined,
      status: (input.status as PlatformUserStatus) ?? undefined
    },
    select: platformUserSelect
  });

  return formatPlatformUser(created as PlatformUserRecord);
};

export const findAllPlatformUsers = async (
  pagination: PaginationParams,
  filters: PlatformUserFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.platform_usersWhereInput = {
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.status) where.status = filters.status as PlatformUserStatus;
  if (filters.role) where.role = filters.role as PlatformUserRole;

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.platform_users.findMany({
      where,
      select: platformUserSelect,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.platform_users.count({ where })
  ]);

  return {
    data: items.map((item) => formatPlatformUser(item as PlatformUserRecord)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findPlatformUserById = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid platform user id", 400);
  }

  const user = await prisma.platform_users.findFirst({
    where: { id: toBigInt(id), deleted_at: null },
    select: platformUserSelect
  });

  if (!user) {
    throw new AppError("not_found", "Platform user not found", 404);
  }

  return formatPlatformUser(user as PlatformUserRecord);
};

export const updatePlatformUser = async (id: string, input: PlatformUserUpdateInput) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid platform user id", 400);
  }

  const existing = await prisma.platform_users.findFirst({
    where: { id: toBigInt(id), deleted_at: null }
  });

  if (!existing) {
    throw new AppError("not_found", "Platform user not found", 404);
  }

  if (input.email) {
    const emailInUse = await prisma.platform_users.findFirst({
      where: {
        email: input.email,
        deleted_at: null,
        NOT: { id: existing.id }
      }
    });

    if (emailInUse) {
      throw new AppError("conflict", "Email already in use", 409);
    }
  }

  const password_hash = input.password
    ? await hashPassword(input.password)
    : undefined;

  const updated = await prisma.platform_users.update({
    where: { id: existing.id },
    data: {
      name: input.name ?? undefined,
      email: input.email ?? undefined,
      password_hash,
      role: input.role ? (input.role as PlatformUserRole) : undefined,
      access_scope: input.access_scope
        ? (input.access_scope as PlatformUserAccessScope)
        : undefined,
      permissions: input.permissions ?? undefined,
      status: input.status ? (input.status as PlatformUserStatus) : undefined
    },
    select: platformUserSelect
  });

  return formatPlatformUser(updated as PlatformUserRecord);
};

export const softDeletePlatformUser = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid platform user id", 400);
  }

  const existing = await prisma.platform_users.findFirst({
    where: { id: toBigInt(id), deleted_at: null }
  });

  if (!existing) {
    throw new AppError("not_found", "Platform user not found", 404);
  }

  const deleted = await prisma.platform_users.update({
    where: { id: existing.id },
    data: { deleted_at: new Date() },
    select: platformUserSelect
  });

  return formatPlatformUser(deleted as PlatformUserRecord);
};
