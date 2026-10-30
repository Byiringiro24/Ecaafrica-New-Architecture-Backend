import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import type { roles, users, UserRole, UserStatus } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AuditActorType } from "../constants/enums";
import { AppError } from "../middleware/errorHandler";
import { hashPassword } from "../utils/hash";
import { logAction } from "./audit.service";

type UserCreateInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  role: string;
  roles?: string[] | null;
  status?: string;
  avatar_url?: string | null;
};

type UserUpdateInput = Partial<UserCreateInput> & {
  password?: string;
};

type UserFilters = {
  status?: string;
  role?: string | string[];
  q?: string;
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

const roleSelect = {
  id: true,
  name: true,
  slug: true,
  permissions: true,
  is_system: true
} satisfies Prisma.rolesSelect;

type RoleRecord = Pick<roles, "id" | "name" | "slug" | "permissions" | "is_system">;

type UserRecord = Pick<
  users,
  | "id"
  | "uuid"
  | "school_id"
  | "name"
  | "email"
  | "phone"
  | "role"
  | "status"
  | "avatar_url"
  | "last_login_at"
  | "created_at"
  | "updated_at"
  | "deleted_at"
> & {
  user_roles: { role: RoleRecord }[];
};

const userSelect = {
  id: true,
  uuid: true,
  school_id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  avatar_url: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  user_roles: {
    where: {
      role: {
        deleted_at: null
      }
    },
    select: {
      role: {
        select: roleSelect
      }
    }
  }
} satisfies Prisma.usersSelect;

const formatRole = (role: RoleRecord) => ({
  id: role.id.toString(),
  name: role.name,
  slug: role.slug,
  permissions: role.permissions,
  is_system: role.is_system
});

const formatUser = (user: UserRecord) => ({
  id: user.id.toString(),
  uuid: user.uuid,
  school_id: user.school_id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  avatar_url: user.avatar_url,
  last_login_at: user.last_login_at,
  created_at: user.created_at,
  updated_at: user.updated_at,
  deleted_at: user.deleted_at,
  roles: user.user_roles.map((userRole) => formatRole(userRole.role))
});

const resolveUserWhere = (id: string) => {
  if (/^\d+$/.test(id)) {
    return { id: toBigInt(id) };
  }

  return { uuid: id };
};

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "name", "status", "last_login_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.usersOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.usersOrderByWithRelationInput;
};

const normalizeRoleList = (value?: string[] | string | null) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(
    values
      .map((role) => (typeof role === "string" ? role.trim().toLowerCase() : ""))
      .filter(Boolean)
  )];
};

const syncUserSecondaryRoles = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  userId: bigint,
  roleSlugs: string[]
) => {
  const desired = [...new Set(roleSlugs.map((role) => role.trim().toLowerCase()).filter(Boolean))];
  if (!desired.length) return;

  const available = await tx.roles.findMany({
    where: {
      school_id: toBigInt(schoolId),
      slug: { in: desired },
      deleted_at: null
    },
    select: { id: true, slug: true }
  });

  const availableMap = new Map(available.map((role) => [role.slug.toLowerCase(), role.id]));
  const missing = desired.filter((slug) => !availableMap.has(slug));

  if (missing.length) {
    throw new AppError("not_found", `Roles not found: ${missing.join(", ")}`, 404);
  }

  await tx.user_roles.createMany({
    data: desired.map((slug) => ({
      user_id: userId,
      role_id: availableMap.get(slug)!,
      school_id: toBigInt(schoolId)
    })),
    skipDuplicates: true
  });
};

const syncUserSecondaryRoleSet = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  userId: bigint,
  primaryRole: string | null | undefined,
  roleSlugs: string[] | undefined
) => {
  const desired = normalizeRoleList(roleSlugs ?? []);
  const safePrimary = primaryRole ? primaryRole.trim().toLowerCase() : null;
  const finalDesired = desired.filter((slug) => slug !== safePrimary);

  if (!finalDesired.length) {
    await tx.user_roles.deleteMany({
      where: { user_id: userId, school_id: toBigInt(schoolId) }
    });
    return;
  }

  const currentAssignments = await tx.user_roles.findMany({
    where: { user_id: userId, school_id: toBigInt(schoolId) },
    select: { id: true, role: { select: { slug: true } } }
  });

  const currentMap = new Map(currentAssignments.map((assignment) => [assignment.role.slug.toLowerCase(), assignment.id]));
  const toRemove = currentAssignments
    .filter((assignment) => !finalDesired.includes(assignment.role.slug.toLowerCase()))
    .map((assignment) => assignment.id);

  if (toRemove.length) {
    await tx.user_roles.deleteMany({ where: { id: { in: toRemove } } });
  }

  const toAdd = finalDesired.filter((slug) => !currentMap.has(slug));
  if (toAdd.length) {
    await syncUserSecondaryRoles(tx, schoolId, userId, toAdd);
  }
};

export const createUser = async (
  schoolId: string | number | bigint,
  input: UserCreateInput
) => {
  const email = input.email?.trim().toLowerCase() ?? null;
  const result = await prisma.$transaction(async (tx) => {
    if (email) {
      const existing = await tx.users.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          email
        }
      });

      if (existing) {
        throw new AppError("conflict", "Email already in use", 409);
      }
    }

    const password_hash = await hashPassword(input.password);
    let created;
    try {
      created = await tx.users.create({
        data: {
          uuid: uuidv4(),
          school_id: toBigInt(schoolId),
          name: input.name,
          email,
          phone: input.phone ?? null,
          password_hash,
          role: input.role as UserRole,
          status: input.status ? (input.status as UserStatus) : undefined,
          avatar_url: input.avatar_url ?? null
        },
        select: userSelect
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("conflict", "Email already in use for this school", 409);
      }
      throw error;
    }

    const secondaryRoles = normalizeRoleList(input.roles).filter((slug) => slug !== input.role.trim().toLowerCase());
    if (secondaryRoles.length) {
      await syncUserSecondaryRoles(tx, schoolId, created.id, secondaryRoles);
    }

    const refreshed = await tx.users.findFirst({
      where: { id: created.id },
      select: userSelect
    });
    const persistedUser = (refreshed ?? created) as UserRecord | null;

    if (!persistedUser) {
      throw new AppError("not_found", "User not found after creation", 404);
    }

    return formatUser(persistedUser);
  });

  void logAction(null, AuditActorType.SYSTEM, "create", "users", result.id, {
    schoolId,
    resourceName: result.name,
    newValues: { email: result.email, role: result.role }
  });

  // Send onboarding email for staff roles when an email address is provided.
  try {
    const rolesMod = await import("../constants/roles");
    if (result.email && result.role && rolesMod.isStaffRole(result.role)) {
      // Dynamically import mailer so tests can mock it before module load
      const mailer = await import("../utils/mailer");
      const sendPromise = mailer.sendTeacherOnboardingEmail?.(result.email, result.name);
      if (sendPromise && typeof (sendPromise as Promise<unknown>).catch === "function") {
        (sendPromise as Promise<unknown>).catch(() => {});
      }
    }
  } catch (err) {
    // Swallow email errors to preserve user creation flow (tests expect this)
  }

  return result;
};

export const findAllUsers = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: UserFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const q = pagination.q ?? filters.q;
  const where: Prisma.usersWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };
  const appendAnd = (condition: Prisma.usersWhereInput) => {
    const existing = where.AND;
    where.AND = [
      ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
      condition,
    ];
  };

  if (filters.status) where.status = filters.status as UserStatus;
  if (filters.role) {
    const roles = Array.isArray(filters.role) ? filters.role : filters.role.split(",").map(r => r.trim());
    // A teacher who also has a patron/DOS role must still appear in teacher
    // pickers. Search both the primary users.role and the secondary role join.
    appendAnd({
      OR: [
        { role: { in: roles as UserRole[] } },
        {
          user_roles: {
            some: {
              school_id: toBigInt(schoolId),
              role: { slug: { in: roles }, deleted_at: null },
            },
          },
        },
      ],
    });
  }

  if (q) {
    const search: Prisma.usersWhereInput[] = [
      { name: { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q, mode: "insensitive" as const } }
    ];
    if (where.AND) appendAnd({ OR: search });
    else where.OR = search;
  }

  const [items, total] = await prisma.$transaction([
    prisma.users.findMany({
      where,
      select: userSelect,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.users.count({ where })
  ]);

  return {
    data: items.map((item) => formatUser(item as UserRecord)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findUserById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  const user = await prisma.users.findFirst({
    where: {
      ...resolveUserWhere(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    select: userSelect
  });

  if (!user) {
    throw new AppError("not_found", "User not found", 404);
  }

  return formatUser(user as UserRecord);
};

export const updateUser = async (
  schoolId: string | number | bigint,
  id: string,
  input: UserUpdateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.users.findFirst({
      where: {
        ...resolveUserWhere(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "User not found", 404);
    }

    const normalizedEmail = input.email?.trim().toLowerCase();
    if (normalizedEmail !== undefined && normalizedEmail !== null) {
      const emailInUse = await tx.users.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          email: normalizedEmail,
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

    const data: Prisma.usersUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = normalizedEmail ?? null;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.role !== undefined) data.role = input.role as UserRole;
    if (input.status !== undefined) data.status = input.status as UserStatus;
    if (input.avatar_url !== undefined) data.avatar_url = input.avatar_url;
    if (password_hash) data.password_hash = password_hash;

    const updated = await tx.users.update({
      where: { id: existing.id },
      data,
      select: userSelect
    });

    if (input.roles !== undefined) {
      await syncUserSecondaryRoleSet(
        tx,
        schoolId,
        existing.id,
        input.role ?? updated.role,
        input.roles ?? []
      );
    }

    const refreshed = await tx.users.findFirst({
      where: { id: existing.id },
      select: userSelect
    });

    if (!refreshed) {
      throw new AppError("not_found", "User not found after update", 404);
    }

    return formatUser(refreshed as UserRecord);
  });

  void logAction(null, AuditActorType.SYSTEM, "update", "users", result.id, {
    schoolId,
    resourceName: result.name,
    newValues: input
  });

  return result;
};

export const softDeleteUser = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    const existing = await tx.users.findFirst({
      where: {
        ...resolveUserWhere(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "User not found", 404);
    }

    const deleted = await tx.users.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() },
      select: userSelect
    });

    return formatUser(deleted as UserRecord);
  });

export const assignRole = async (
  schoolId: string | number | bigint,
  userId: string,
  roleId: string
) =>
  prisma.$transaction(async (tx) => {
    const user = await tx.users.findFirst({
      where: {
        ...resolveUserWhere(userId),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!user) {
      throw new AppError("not_found", "User not found", 404);
    }

    if (!/^\d+$/.test(roleId)) {
      throw new AppError("bad_request", "Invalid role id", 400);
    }

    const role = await tx.roles.findFirst({
      where: {
        id: toBigInt(roleId),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!role) {
      throw new AppError("not_found", "Role not found", 404);
    }

    const existing = await tx.user_roles.findFirst({
      where: {
        user_id: user.id,
        role_id: role.id
      }
    });

    if (existing) {
      throw new AppError("conflict", "User already has this role", 409);
    }

    await tx.user_roles.create({
      data: {
        user_id: user.id,
        role_id: role.id,
        school_id: toBigInt(schoolId)
      }
    });

    const updated = await tx.users.findFirst({
      where: { id: user.id },
      select: userSelect
    });

    if (!updated) {
      throw new AppError("not_found", "User not found", 404);
    }

    return formatUser(updated as UserRecord);
  });

export const removeRole = async (
  schoolId: string | number | bigint,
  userId: string,
  roleId: string
) =>
  prisma.$transaction(async (tx) => {
    const user = await tx.users.findFirst({
      where: {
        ...resolveUserWhere(userId),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!user) {
      throw new AppError("not_found", "User not found", 404);
    }

    if (!/^\d+$/.test(roleId)) {
      throw new AppError("bad_request", "Invalid role id", 400);
    }

    const role = await tx.roles.findFirst({
      where: {
        id: toBigInt(roleId),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!role) {
      throw new AppError("not_found", "Role not found", 404);
    }

    const existing = await tx.user_roles.findFirst({
      where: {
        user_id: user.id,
        role_id: role.id
      }
    });

    if (!existing) {
      throw new AppError("not_found", "User role assignment not found", 404);
    }

    await tx.user_roles.delete({
      where: { id: existing.id }
    });

    const updated = await tx.users.findFirst({
      where: { id: user.id },
      select: userSelect
    });

    if (!updated) {
      throw new AppError("not_found", "User not found", 404);
    }

    return formatUser(updated as UserRecord);
  });
