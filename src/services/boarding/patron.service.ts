/**
 * Patron / Matron dormitory assignment service.
 * A patron/matron can be assigned to one or many dormitories.
 * They can only see students, attendance, dining, and leaves for assigned dorms.
 */
import { DormGender, UserRole } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

const toBigInt = (v: string | number | bigint) =>
  typeof v === "bigint" ? v : BigInt(v);

const fmt = (r: {
  id: bigint;
  school_id: bigint;
  user_id: bigint;
  dormitory_id: bigint;
  assigned_by: bigint | null;
  assigned_at: Date;
  is_active: boolean;
}) => ({
  id: r.id.toString(),
  school_id: r.school_id.toString(),
  user_id: r.user_id.toString(),
  dormitory_id: r.dormitory_id.toString(),
  assigned_by: r.assigned_by?.toString() ?? null,
  assigned_at: r.assigned_at.toISOString(),
  is_active: r.is_active,
});

/** List all dormitory assignments for a user (patron/matron) */
export const listPatronAssignments = async (
  schoolId: string | number | bigint,
  userId: string | number | bigint
) => {
  const user = await prisma.users.findFirst({
    where: {
      id: toBigInt(userId),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
    select: { role: true },
  });
  const expectedGender =
    user?.role === UserRole.patron
      ? DormGender.male
      : user?.role === UserRole.matron
        ? DormGender.female
        : undefined;
  const rows = await prisma.patron_dormitory_assignments.findMany({
    where: {
      school_id: toBigInt(schoolId),
      user_id: toBigInt(userId),
      is_active: true,
      ...(expectedGender ? { dormitory: { gender: expectedGender } } : {}),
    },
    include: {
      dormitory: { select: { id: true, name: true, gender: true, block_name: true, hostel_name: true } },
    },
    orderBy: { assigned_at: "desc" },
  });
  return rows.map((r) => ({ ...fmt(r), dormitory: { ...r.dormitory, id: r.dormitory.id.toString() } }));
};

/** List all patrons/matrons for a dormitory */
export const listDormitoryPatrons = async (
  schoolId: string | number | bigint,
  dormitoryId: string | number | bigint
) => {
  const rows = await prisma.patron_dormitory_assignments.findMany({
    where: { school_id: toBigInt(schoolId), dormitory_id: toBigInt(dormitoryId), is_active: true },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { assigned_at: "desc" },
  });
  return rows.map((r) => ({ ...fmt(r), user: { ...r.user, id: r.user.id.toString() } }));
};

/** Assign a patron/matron to one or more dormitories */
export const assignPatronToDormitories = async (
  schoolId: string | number | bigint,
  userId: string | number | bigint,
  dormitoryIds: (string | number | bigint)[],
  assignedBy: string | number | bigint
) => {
  const schoolBig = toBigInt(schoolId);
  const userBig = toBigInt(userId);

  // Verify user exists and has a boarding role
  const user = await prisma.users.findFirst({
    where: { id: userBig, school_id: schoolBig, deleted_at: null },
  });
  if (!user) throw new AppError("not_found", "User not found", 404);
  if (!["patron", "matron", "director_of_discipline"].includes(user.role)) {
    throw new AppError("bad_request", "User must have a boarding role (patron/matron/director_of_discipline)", 400);
  }

  const expectedGender =
    user.role === UserRole.patron
      ? DormGender.male
      : user.role === UserRole.matron
        ? DormGender.female
        : undefined;

  const normalizedDormitoryIds = [...new Set(dormitoryIds.map(toBigInt))];
  const dormitories = await prisma.dormitories.findMany({
    where: { id: { in: normalizedDormitoryIds }, school_id: schoolBig },
  });
  if (dormitories.length !== normalizedDormitoryIds.length) {
    throw new AppError("not_found", "One or more dormitories not found", 404);
  }
  if (
    expectedGender &&
    dormitories.some((dormitory) => dormitory.gender !== expectedGender)
  ) {
    throw new AppError(
      "bad_request",
      `${user.role === UserRole.patron ? "Patrons" : "Matrons"} can only be assigned to ${expectedGender} dormitories`,
      400,
    );
  }

  const created: ReturnType<typeof fmt>[] = [];
  for (const dormBig of normalizedDormitoryIds) {
    const existing = await prisma.patron_dormitory_assignments.findFirst({
      where: { user_id: userBig, dormitory_id: dormBig },
    });

    if (existing) {
      if (!existing.is_active) {
        const updated = await prisma.patron_dormitory_assignments.update({
          where: { id: existing.id },
          data: { is_active: true, assigned_by: toBigInt(assignedBy), assigned_at: new Date() },
        });
        created.push(fmt(updated));
      }
    } else {
      const row = await prisma.patron_dormitory_assignments.create({
        data: {
          school_id: schoolBig,
          user_id: userBig,
          dormitory_id: dormBig,
          assigned_by: toBigInt(assignedBy),
          is_active: true,
        },
      });
      created.push(fmt(row));
    }
  }
  return created;
};

/** Remove a patron/matron from a dormitory */
export const removePatronFromDormitory = async (
  schoolId: string | number | bigint,
  userId: string | number | bigint,
  dormitoryId: string | number | bigint
) => {
  const row = await prisma.patron_dormitory_assignments.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      user_id: toBigInt(userId),
      dormitory_id: toBigInt(dormitoryId),
    },
  });
  if (!row) throw new AppError("not_found", "Assignment not found", 404);
  const updated = await prisma.patron_dormitory_assignments.update({
    where: { id: row.id },
    data: { is_active: false },
  });
  return fmt(updated);
};

/**
 * Returns the dormitory IDs the requesting patron/matron is assigned to.
 * Used as a scope filter throughout boarding queries.
 */
export const getPatronDormitoryScope = async (
  schoolId: string | number | bigint,
  userId: string | number | bigint
): Promise<bigint[]> => {
  const rows = await prisma.patron_dormitory_assignments.findMany({
    where: { school_id: toBigInt(schoolId), user_id: toBigInt(userId), is_active: true },
    select: { dormitory_id: true },
  });
  return rows.map((r) => r.dormitory_id);
};
