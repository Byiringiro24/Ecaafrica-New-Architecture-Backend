import type { Prisma, biometric_enrollments, BiometricType } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type BiometricCreateInput = {
  student_id: string | number | bigint;
  type: string;
  template_hash?: string;
  card_uid?: string;
  enrolled_by?: string | number | bigint;
  is_active?: boolean;
};

type BiometricUpdateInput = Partial<BiometricCreateInput>;

type BiometricFilters = {
  student_id?: string | number | bigint;
  type?: string;
  is_active?: boolean;
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

const formatBiometric = (record: biometric_enrollments) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id.toString(),
  enrolled_by: record.enrolled_by ? record.enrolled_by.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["enrolled_at", "created_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.biometric_enrollmentsOrderByWithRelationInput;
  }

  return { enrolled_at: "desc" } as Prisma.biometric_enrollmentsOrderByWithRelationInput;
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

export const createBiometricEnrollment = async (
  schoolId: string | number | bigint,
  input: BiometricCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const student = await assertStudent(tx, schoolId, input.student_id);

    const created = await tx.biometric_enrollments.create({
      data: {
        school_id: toBigInt(schoolId),
        student_id: student.id,
        type: input.type as BiometricType,
        template_hash: input.template_hash ?? undefined,
        card_uid: input.card_uid ?? undefined,
        enrolled_by: input.enrolled_by ? toBigInt(input.enrolled_by) : undefined,
        is_active: input.is_active ?? undefined
      }
    });

    return formatBiometric(created);
  });

export const findAllBiometricEnrollments = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: BiometricFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.biometric_enrollmentsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.type) where.type = filters.type as BiometricType;
  if (filters.is_active !== undefined) where.is_active = filters.is_active;

  const [items, total] = await prisma.$transaction([
    prisma.biometric_enrollments.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.biometric_enrollments.count({ where })
  ]);

  return {
    data: items.map((item) => formatBiometric(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findBiometricEnrollmentById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid biometric id", 400);
  }

  const record = await prisma.biometric_enrollments.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!record) {
    throw new AppError("not_found", "Biometric enrollment not found", 404);
  }

  return formatBiometric(record);
};

export const updateBiometricEnrollment = async (
  schoolId: string | number | bigint,
  id: string,
  input: BiometricUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid biometric id", 400);
    }

    const existing = await tx.biometric_enrollments.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Biometric enrollment not found", 404);
    }

    if (input.student_id) {
      await assertStudent(tx, schoolId, input.student_id);
    }

    const data: Prisma.biometric_enrollmentsUpdateInput = {};
    if (input.student_id !== undefined) {
      data.student = { connect: { id: toBigInt(input.student_id) } };
    }
    if (input.type !== undefined) data.type = input.type as BiometricType;
    if (input.template_hash !== undefined) data.template_hash = input.template_hash;
    if (input.card_uid !== undefined) data.card_uid = input.card_uid;
    if (input.enrolled_by !== undefined) {
      data.enrolled_by = input.enrolled_by ? toBigInt(input.enrolled_by) : null;
    }
    if (input.is_active !== undefined) data.is_active = input.is_active;

    const updated = await tx.biometric_enrollments.update({
      where: { id: existing.id },
      data
    });

    return formatBiometric(updated);
  });

export const deleteBiometricEnrollment = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid biometric id", 400);
    }

    const existing = await tx.biometric_enrollments.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Biometric enrollment not found", 404);
    }

    await tx.biometric_enrollments.delete({
      where: { id: existing.id }
    });

    return formatBiometric(existing);
  });
