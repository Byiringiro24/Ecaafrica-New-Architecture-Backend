import type { Prisma, parents_guardians } from "@prisma/client";
import { UserRole } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type ParentCreateInput = {
  user_id?: string | number | bigint;
  first_name: string;
  last_name: string;
  phone: string;
  phone_alt?: string;
  email?: string;
  national_id?: string;
  relationship: string;
  address?: string;
  occupation?: string;
};

type ParentUpdateInput = Partial<ParentCreateInput>;

type ParentFilters = {
  q?: string;
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

const formatParent = (record: parents_guardians) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  user_id: record.user_id ? record.user_id.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "first_name", "last_name"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.parents_guardiansOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.parents_guardiansOrderByWithRelationInput;
};

const assertParentUser = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  userId: string | number | bigint
) => {
  const user = await tx.users.findFirst({
    where: {
      id: toBigInt(userId),
      school_id: toBigInt(schoolId),
      role: UserRole.parent,
      deleted_at: null
    }
  });

  if (!user) {
    throw new AppError("not_found", "Parent user not found", 404);
  }

  return user;
};

const assertStudent = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await tx.students.findFirst({
    where: {
      id: toBigInt(studentId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  return student;
};

const assertParent = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  parentId: string | number | bigint
) => {
  const parent = await tx.parents_guardians.findFirst({
    where: {
      id: toBigInt(parentId),
      school_id: toBigInt(schoolId)
    }
  });

  if (!parent) {
    throw new AppError("not_found", "Parent not found", 404);
  }

  return parent;
};

export const createParent = async (
  schoolId: string | number | bigint,
  input: ParentCreateInput
) =>
  prisma.$transaction(async (tx) => {
    if (input.user_id) {
      await assertParentUser(tx, schoolId, input.user_id);
    }

    const created = await tx.parents_guardians.create({
      data: {
        school_id: toBigInt(schoolId),
        user_id: input.user_id ? toBigInt(input.user_id) : undefined,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone,
        phone_alt: input.phone_alt ?? undefined,
        email: input.email ?? undefined,
        national_id: input.national_id ?? undefined,
        relationship: input.relationship,
        address: input.address ?? undefined,
        occupation: input.occupation ?? undefined
      }
    });

    return formatParent(created);
  });

export const findAllParents = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: ParentFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.parents_guardiansWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.q ?? q) {
    const keyword = filters.q ?? q;
    if (keyword) {
      where.OR = [
        { first_name: { contains: keyword, mode: "insensitive" } },
        { last_name: { contains: keyword, mode: "insensitive" } },
        { phone: { contains: keyword, mode: "insensitive" } },
        { email: { contains: keyword, mode: "insensitive" } }
      ];
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.parents_guardians.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.parents_guardians.count({ where })
  ]);

  return {
    data: items.map((item) => formatParent(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findParentById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid parent id", 400);
  }

  const parent = await prisma.parents_guardians.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!parent) {
    throw new AppError("not_found", "Parent not found", 404);
  }

  return formatParent(parent);
};

export const updateParent = async (
  schoolId: string | number | bigint,
  id: string,
  input: ParentUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid parent id", 400);
    }

    const existing = await tx.parents_guardians.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Parent not found", 404);
    }

    if (input.user_id) {
      await assertParentUser(tx, schoolId, input.user_id);
    }

    const data: Prisma.parents_guardiansUpdateInput = {};
    if (input.user_id !== undefined) {
      data.user = input.user_id
        ? { connect: { id: toBigInt(input.user_id) } }
        : { disconnect: true };
    }
    if (input.first_name !== undefined) data.first_name = input.first_name;
    if (input.last_name !== undefined) data.last_name = input.last_name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.phone_alt !== undefined) data.phone_alt = input.phone_alt;
    if (input.email !== undefined) data.email = input.email;
    if (input.national_id !== undefined) data.national_id = input.national_id;
    if (input.relationship !== undefined) data.relationship = input.relationship;
    if (input.address !== undefined) data.address = input.address;
    if (input.occupation !== undefined) data.occupation = input.occupation;

    const updated = await tx.parents_guardians.update({
      where: { id: existing.id },
      data
    });

    return formatParent(updated);
  });

export const deleteParent = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid parent id", 400);
    }

    const existing = await tx.parents_guardians.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Parent not found", 404);
    }

    await tx.parents_guardians.delete({
      where: { id: existing.id }
    });

    return formatParent(existing);
  });

export const linkParentToStudent = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
  parentId: string | number | bigint,
  isPrimary?: boolean
) =>
  prisma.$transaction(async (tx) => {
    const student = await assertStudent(tx, schoolId, studentId);
    const parent = await assertParent(tx, schoolId, parentId);

    const existing = await tx.student_parent_links.findFirst({
      where: {
        student_id: student.id,
        parent_id: parent.id
      }
    });

    if (existing) {
      throw new AppError("conflict", "Parent already linked", 409);
    }

    const created = await tx.student_parent_links.create({
      data: {
        student_id: student.id,
        parent_id: parent.id,
        is_primary: isPrimary ?? false
      }
    });

    return {
      id: created.id.toString(),
      student_id: created.student_id.toString(),
      parent_id: created.parent_id.toString(),
      is_primary: created.is_primary
    };
  });

export const unlinkParentFromStudent = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
  parentId: string | number | bigint
) =>
  prisma.$transaction(async (tx) => {
    const student = await assertStudent(tx, schoolId, studentId);
    const parent = await assertParent(tx, schoolId, parentId);

    const existing = await tx.student_parent_links.findFirst({
      where: {
        student_id: student.id,
        parent_id: parent.id
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Parent link not found", 404);
    }

    await tx.student_parent_links.delete({
      where: { id: existing.id }
    });

    return {
      id: existing.id.toString(),
      student_id: existing.student_id.toString(),
      parent_id: existing.parent_id.toString(),
      is_primary: existing.is_primary
    };
  });
