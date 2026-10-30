import { Prisma, type roles } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";
import { ROLE_PERMISSIONS } from "../constants/permissions";
import { SchoolRole } from "../constants/roles";

const DEFAULT_ROLE_NAMES: Record<SchoolRole, string> = {
  [SchoolRole.SCHOOL_ADMIN]: "School Admin",
  [SchoolRole.TEACHER]: "Teacher",
  [SchoolRole.STAFF]: "Staff",
  [SchoolRole.GATE_KEEPER]: "Gate Keeper",
  [SchoolRole.BOARDING_OFFICER]: "Boarding Officer",
  [SchoolRole.DIRECTOR_OF_DISCIPLINE]: "Director of Discipline",
  [SchoolRole.DIRECTOR_OF_STUDIES]: "Director of Studies",
  [SchoolRole.PATRON]: "Patron",
  [SchoolRole.MATRON]: "Matron",
  [SchoolRole.FINANCE_OFFICER]: "Finance Officer",
  [SchoolRole.PARENT]: "Parent",
  [SchoolRole.STUDENT]: "Student"
};

type RoleCreateInput = {
  name: string;
  slug: string;
  permissions?: Prisma.InputJsonValue | null;
  is_system?: boolean;
};

type RoleUpdateInput = Partial<RoleCreateInput>;

type RoleFilters = {
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
  school_id: true,
  name: true,
  slug: true,
  permissions: true,
  is_system: true,
  created_at: true,
  updated_at: true,
  deleted_at: true
} satisfies Prisma.rolesSelect;

type RoleRecord = Pick<
  roles,
  | "id"
  | "school_id"
  | "name"
  | "slug"
  | "permissions"
  | "is_system"
  | "created_at"
  | "updated_at"
  | "deleted_at"
>;

const formatRole = (role: RoleRecord) => ({
  ...role,
  id: role.id.toString(),
  school_id: role.school_id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "name", "slug"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.rolesOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.rolesOrderByWithRelationInput;
};

const ensureDefaultSchoolRoles = async (schoolId: string | number | bigint) => {
  const normalizedSchoolId = toBigInt(schoolId);
  const existing = await prisma.roles.findMany({
    where: { school_id: normalizedSchoolId, deleted_at: null },
    select: { slug: true }
  });
  const existingSlugs = new Set(existing.map((role) => role.slug));
  const missing = Object.values(SchoolRole).filter((slug) => !existingSlugs.has(slug));

  if (missing.length === 0) return;

  await prisma.roles.createMany({
    data: missing.map((slug) => ({
      school_id: normalizedSchoolId,
      name: DEFAULT_ROLE_NAMES[slug],
      slug,
      permissions: ROLE_PERMISSIONS[slug],
      is_system: true
    })),
    skipDuplicates: true
  });
};

export const createRole = async (
  schoolId: string | number | bigint,
  input: RoleCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const existing = await tx.roles.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        slug: input.slug,
        deleted_at: null
      }
    });

    if (existing) {
      throw new AppError("conflict", "Role slug already in use", 409);
    }

    const data: Prisma.rolesCreateInput = {
      school: { connect: { id: toBigInt(schoolId) } },
      name: input.name,
      slug: input.slug,
      permissions: input.permissions ?? Prisma.JsonNull
    };

    if (input.is_system !== undefined) {
      data.is_system = input.is_system;
    }

    const created = await tx.roles.create({
      data,
      select: roleSelect
    });

    return formatRole(created as RoleRecord);
  });

export const findAllRoles = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: RoleFilters = {}
) => {
  // Older schools may have users but no role catalog yet. Repair that state
  // lazily so role assignment remains available without a manual SQL step.
  await ensureDefaultSchoolRoles(schoolId);

  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.rolesWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.roles.findMany({
      where,
      select: roleSelect,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.roles.count({ where })
  ]);

  return {
    data: items.map((item) => formatRole(item as RoleRecord)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findRoleById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid role id", 400);
  }

  const role = await prisma.roles.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    select: roleSelect
  });

  if (!role) {
    throw new AppError("not_found", "Role not found", 404);
  }

  return formatRole(role as RoleRecord);
};

export const updateRole = async (
  schoolId: string | number | bigint,
  id: string,
  input: RoleUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid role id", 400);
    }

    const existing = await tx.roles.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Role not found", 404);
    }

    if (input.slug) {
      const slugInUse = await tx.roles.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          slug: input.slug,
          deleted_at: null,
          NOT: { id: existing.id }
        }
      });

      if (slugInUse) {
        throw new AppError("conflict", "Role slug already in use", 409);
      }
    }

    const updated = await tx.roles.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? undefined,
        slug: input.slug ?? undefined,
        permissions: input.permissions ?? undefined,
        is_system: input.is_system ?? undefined
      },
      select: roleSelect
    });

    return formatRole(updated as RoleRecord);
  });

export const softDeleteRole = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid role id", 400);
    }

    const existing = await tx.roles.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Role not found", 404);
    }

    const deleted = await tx.roles.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() },
      select: roleSelect
    });

    return formatRole(deleted as RoleRecord);
  });
