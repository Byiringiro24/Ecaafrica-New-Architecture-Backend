import { DormGender, Gender, Prisma, UserRole } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { hashPassword } from "../../utils/hash";

type Id = string | number | bigint;

type SupervisorCreateInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  role: Extract<UserRole, "patron" | "matron">;
  gender?: Gender;
  dormitory_ids?: Id[];
};

const toBigInt = (value: Id) =>
  typeof value === "bigint" ? value : BigInt(value);

const supervisorRoles: Array<Extract<UserRole, "patron" | "matron">> = [
  UserRole.patron,
  UserRole.matron,
];

const formatSupervisor = (record: {
  id: bigint;
  user_id: bigint | null;
  school_id: bigint;
  gender: Gender | null;
  user: {
    id: bigint;
    name: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
  } | null;
  dormitory_assignments: Array<{
    id: bigint;
    dormitory_id: bigint;
    removed_at: Date | null;
    dormitory: { id: bigint; name: string; gender: string; capacity: number };
  }>;
}) => ({
  id: record.id.toString(),
  user_id: record.user_id?.toString() ?? null,
  school_id: record.school_id.toString(),
  name: record.user?.name ?? "Unlinked staff member",
  email: record.user?.email ?? null,
  phone: record.user?.phone ?? null,
  role: record.user?.role ?? null,
  gender: record.gender,
  dormitories: record.dormitory_assignments
    .filter((assignment) => !assignment.removed_at)
    .map((assignment) => ({
      assignment_id: assignment.id.toString(),
      id: assignment.dormitory.id.toString(),
      name: assignment.dormitory.name,
      gender: assignment.dormitory.gender,
      capacity: assignment.dormitory.capacity,
    })),
});

const include = {
  user: {
    select: { id: true, name: true, email: true, phone: true, role: true },
  },
  dormitory_assignments: {
    include: {
      dormitory: {
        select: { id: true, name: true, gender: true, capacity: true },
      },
    },
    orderBy: { assigned_at: "desc" as const },
  },
} satisfies Prisma.staff_profilesInclude;

const assertDormitories = async (
  tx: Prisma.TransactionClient,
  schoolId: Id,
  dormitoryIds: Id[],
  supervisorRole?: Extract<UserRole, "patron" | "matron">,
) => {
  const normalized = [...new Set(dormitoryIds.map(toBigInt))];
  if (!normalized.length) return normalized;
  const dormitories = await tx.dormitories.findMany({
    where: { school_id: toBigInt(schoolId), id: { in: normalized } },
    select: { id: true, name: true, gender: true },
  });
  if (dormitories.length !== normalized.length) {
    throw new AppError(
      "bad_request",
      "One or more dormitories do not belong to this school",
      400,
    );
  }

  if (supervisorRole) {
    const expectedGender =
      supervisorRole === UserRole.patron ? DormGender.male : DormGender.female;
    const incompatible = dormitories.find(
      (dormitory) => dormitory.gender !== expectedGender,
    );
    if (incompatible) {
      throw new AppError(
        "bad_request",
        `${supervisorRole === UserRole.patron ? "Patrons" : "Matrons"} can only be assigned to ${expectedGender} dormitories`,
        400,
      );
    }
  }

  return normalized;
};

export const createBoardingSupervisor = async (
  schoolId: Id,
  input: SupervisorCreateInput,
) =>
  prisma.$transaction(async (tx) => {
    if (!supervisorRoles.includes(input.role)) {
      throw new AppError(
        "bad_request",
        "Supervisor role must be Patron or Matron",
        400,
      );
    }
    if (!input.email && !input.phone) {
      throw new AppError("bad_request", "Email or phone is required", 400);
    }
    if (input.email) {
      const duplicate = await tx.users.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          email: input.email,
          deleted_at: null,
        },
      });
      if (duplicate)
        throw new AppError("conflict", "Email already in use", 409);
    }
    const dormitoryIds = await assertDormitories(
      tx,
      schoolId,
      input.dormitory_ids ?? [],
      input.role,
    );
    const user = await tx.users.create({
      data: {
        uuid: uuidv4(),
        school_id: toBigInt(schoolId),
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        password_hash: await hashPassword(input.password),
        role: input.role,
        status: "active",
      },
    });
    const profile = await tx.staff_profiles.create({
      data: {
        school_id: toBigInt(schoolId),
        user_id: user.id,
        gender: input.gender,
        department: "Boarding",
      },
    });
    if (dormitoryIds.length) {
      await tx.dormitory_supervisor_assignments.createMany({
        data: dormitoryIds.map((dormitory_id) => ({
          school_id: toBigInt(schoolId),
          dormitory_id,
          staff_profile_id: profile.id,
        })),
      });
    }
    const created = await tx.staff_profiles.findUniqueOrThrow({
      where: { id: profile.id },
      include,
    });
    return formatSupervisor(created);
  });

export const listBoardingSupervisors = async (
  schoolId: Id,
  userId?: Id,
  ownOnly = false,
) => {
  const records = await prisma.staff_profiles.findMany({
    where: {
      school_id: toBigInt(schoolId),
      deleted_at: null,
      user: {
        role: { in: supervisorRoles },
        ...(ownOnly && userId ? { id: toBigInt(userId) } : {}),
      },
    },
    include,
    orderBy: { created_at: "desc" },
  });
  return records.map(formatSupervisor);
};

export const getAssignedDormitoryIds = async (schoolId: Id, userId: Id) => {
  const user = await prisma.users.findFirst({
    where: {
      id: toBigInt(userId),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
    select: {
      role: true,
      user_roles: {
        where: { school_id: toBigInt(schoolId), role: { deleted_at: null } },
        select: { role: { select: { slug: true } } },
      },
    },
  });

  const effectiveSupervisorRole = user
    ? [user.role, ...user.user_roles.map((assignment) => assignment.role.slug)]
      .find((role) => supervisorRoles.includes(role as (typeof supervisorRoles)[number]))
    : undefined;

  if (!effectiveSupervisorRole) {
    return [];
  }

  const expectedGender =
    effectiveSupervisorRole === UserRole.patron ? DormGender.male : DormGender.female;

  // Keep both assignment tables readable while older schools migrate to the
  // explicit supervisor assignment model.
  const [legacyAssignments, supervisorAssignments] = await Promise.all([
    prisma.patron_dormitory_assignments.findMany({
      where: {
        school_id: toBigInt(schoolId),
        user_id: toBigInt(userId),
        is_active: true,
        dormitory: { gender: expectedGender },
      },
      select: { dormitory_id: true },
    }),
    prisma.dormitory_supervisor_assignments.findMany({
      where: {
        school_id: toBigInt(schoolId),
        staff_profile: { user_id: toBigInt(userId), deleted_at: null },
        dormitory: { gender: expectedGender },
        removed_at: null,
      },
      select: { dormitory_id: true },
    }),
  ]);

  return [
    ...new Set(
      [...legacyAssignments, ...supervisorAssignments].map((row) =>
        row.dormitory_id.toString(),
      ),
    ),
  ].map((id) => BigInt(id));
};

export const replaceSupervisorDormitories = async (
  schoolId: Id,
  staffProfileId: string,
  dormitoryIds: Id[],
) =>
  prisma.$transaction(async (tx) => {
    const staffProfile = await tx.staff_profiles.findFirst({
      where: {
        id: toBigInt(staffProfileId),
        school_id: toBigInt(schoolId),
        deleted_at: null,
      },
      include: { user: { select: { role: true } } },
    });
    if (
      !staffProfile ||
      !staffProfile.user ||
      !supervisorRoles.some((role) => role === staffProfile.user?.role)
    ) {
      throw new AppError("not_found", "Patron or Matron not found", 404);
    }
    const normalized = await assertDormitories(
      tx,
      schoolId,
      dormitoryIds,
      staffProfile.user.role === UserRole.patron ||
        staffProfile.user.role === UserRole.matron
        ? staffProfile.user.role
        : undefined,
    );
    await tx.dormitory_supervisor_assignments.updateMany({
      where: {
        school_id: toBigInt(schoolId),
        staff_profile_id: staffProfile.id,
        removed_at: null,
      },
      data: { removed_at: new Date() },
    });
    if (normalized.length) {
      for (const dormitory_id of normalized) {
        await tx.dormitory_supervisor_assignments.upsert({
          where: {
            dormitory_id_staff_profile_id: {
              dormitory_id,
              staff_profile_id: staffProfile.id,
            },
          },
          create: {
            school_id: toBigInt(schoolId),
            dormitory_id,
            staff_profile_id: staffProfile.id,
          },
          update: { removed_at: null, assigned_at: new Date() },
        });
      }
    }
    const updated = await tx.staff_profiles.findUniqueOrThrow({
      where: { id: staffProfile.id },
      include,
    });
    return formatSupervisor(updated);
  });
