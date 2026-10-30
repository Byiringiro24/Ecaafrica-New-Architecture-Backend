import { Prisma } from "@prisma/client";
import type { fee_structures } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AuditActorType } from "../../constants/enums";
import { AppError } from "../../middleware/errorHandler";
import { logAction } from "../audit.service";

type FeeStructureCreateInput = {
  academic_year_id: string | number | bigint;
  term_id?: string | number | bigint;
  class_id?: string | number | bigint;
  name: string;
  amount: string | number;
  currency?: string;
  is_mandatory?: boolean;
  is_active?: boolean;
  due_date?: string | Date;
};

type FeeStructureUpdateInput = Partial<FeeStructureCreateInput>;

type FeeStructureFilters = {
  academic_year_id?: string | number | bigint;
  term_id?: string | number | bigint;
  class_id?: string | number | bigint;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const toDecimal = (value: string | number) =>
  typeof value === "string" ? value : value.toString();

const toAuditJsonObject = (
  input: Record<string, unknown>
): Prisma.InputJsonObject => {
  const entries: [string, Prisma.InputJsonValue][] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    if (typeof value === "bigint") {
      entries.push([key, value.toString()]);
      continue;
    }

    if (value instanceof Date) {
      entries.push([key, value.toISOString()]);
      continue;
    }

    entries.push([key, value as Prisma.InputJsonValue]);
  }

  return Object.fromEntries(entries) as Prisma.InputJsonObject;
};

const formatFeeStructure = (record: fee_structures) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  academic_year_id: record.academic_year_id.toString(),
  term_id: record.term_id ? record.term_id.toString() : null,
  class_id: record.class_id ? record.class_id.toString() : null,
  amount: record.amount.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "name", "amount", "due_date"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.fee_structuresOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.fee_structuresOrderByWithRelationInput;
};

const assertAcademicYear = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  academicYearId: string | number | bigint
) => {
  const year = await tx.academic_years.findFirst({
    where: {
      id: toBigInt(academicYearId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!year) {
    throw new AppError("not_found", "Academic year not found", 404);
  }

  return year;
};

const assertTerm = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  termId: string | number | bigint,
  academicYearId: bigint
) => {
  const term = await tx.terms.findFirst({
    where: {
      id: toBigInt(termId),
      school_id: toBigInt(schoolId),
      academic_year_id: academicYearId,
      deleted_at: null
    }
  });

  if (!term) {
    throw new AppError("not_found", "Term not found", 404);
  }

  return term;
};

const assertClass = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  classId: string | number | bigint
) => {
  const classRecord = await tx.classes.findFirst({
    where: {
      id: toBigInt(classId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!classRecord) {
    throw new AppError("not_found", "Class not found", 404);
  }

  return classRecord;
};

export const createFeeStructure = async (
  schoolId: string | number | bigint,
  input: FeeStructureCreateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const academicYear = await assertAcademicYear(tx, schoolId, input.academic_year_id);

    if (input.term_id) {
      await assertTerm(tx, schoolId, input.term_id, academicYear.id);
    }

    if (input.class_id) {
      await assertClass(tx, schoolId, input.class_id);
    }

    const school = await tx.schools.findUnique({
      where: { id: toBigInt(schoolId) },
      select: { currency: true }
    });

    const created = await tx.fee_structures.create({
      data: {
        school_id: toBigInt(schoolId),
        academic_year_id: academicYear.id,
        term_id: input.term_id ? toBigInt(input.term_id) : undefined,
        class_id: input.class_id ? toBigInt(input.class_id) : undefined,
        name: input.name,
        amount: toDecimal(input.amount),
        currency: input.currency ?? school?.currency ?? "RWF",
        is_mandatory: input.is_mandatory ?? true,
        due_date: input.due_date ? toDateValue(input.due_date) : undefined
      }
    });

    return formatFeeStructure(created);
  });

  void logAction(null, AuditActorType.SYSTEM, "create", "fee_structures", result.id, {
    schoolId,
    resourceName: result.name,
    newValues: { amount: result.amount, currency: result.currency }
  });

  return { ...result, is_active: input.is_active ?? true };
};

export const findAllFeeStructures = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: FeeStructureFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.fee_structuresWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.academic_year_id) {
    where.academic_year_id = toBigInt(filters.academic_year_id);
  }

  if (filters.term_id) {
    where.term_id = toBigInt(filters.term_id);
  }

  if (filters.class_id) {
    where.class_id = toBigInt(filters.class_id);
  }

  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.fee_structures.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.fee_structures.count({ where })
  ]);

  const activeRows = items.length
    ? await prisma.$queryRaw<Array<{ id: bigint; is_active: boolean }>>`
        SELECT id, is_active FROM fee_structures WHERE id IN (${Prisma.join(items.map((item) => item.id))})
      `
    : [];
  const activeById = new Map(activeRows.map((row) => [row.id.toString(), row.is_active]));

  return {
    data: items.map((item) => ({ ...formatFeeStructure(item), is_active: activeById.get(item.id.toString()) ?? true })),
    meta: { page, limit, total }
  };
};

export const findFeeStructureById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid fee structure id", 400);
  }

  const record = await prisma.fee_structures.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!record) {
    throw new AppError("not_found", "Fee structure not found", 404);
  }

  const activeRow = await prisma.$queryRaw<Array<{ is_active: boolean }>>`
    SELECT is_active FROM fee_structures WHERE id = ${record.id}
  `;
  return { ...formatFeeStructure(record), is_active: activeRow[0]?.is_active ?? true };
};

export const updateFeeStructure = async (
  schoolId: string | number | bigint,
  id: string,
  input: FeeStructureUpdateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid fee structure id", 400);
    }

    const existing = await tx.fee_structures.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Fee structure not found", 404);
    }

    const academicYearId =
      input.academic_year_id !== undefined
        ? toBigInt(input.academic_year_id)
        : existing.academic_year_id;

    if (input.academic_year_id !== undefined) {
      await assertAcademicYear(tx, schoolId, academicYearId);
    }

    if (input.term_id !== undefined && input.term_id !== null) {
      await assertTerm(tx, schoolId, input.term_id, academicYearId);
    }

    if (input.class_id !== undefined && input.class_id !== null) {
      await assertClass(tx, schoolId, input.class_id);
    }

    const data: Prisma.fee_structuresUncheckedUpdateInput = {};
    if (input.academic_year_id !== undefined) data.academic_year_id = academicYearId;
    if (input.term_id !== undefined) {
      data.term_id = input.term_id ? toBigInt(input.term_id) : null;
    }
    if (input.class_id !== undefined) {
      data.class_id = input.class_id ? toBigInt(input.class_id) : null;
    }
    if (input.name !== undefined) data.name = input.name;
    if (input.amount !== undefined) data.amount = toDecimal(input.amount);
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.is_mandatory !== undefined) data.is_mandatory = input.is_mandatory;
    if (input.due_date !== undefined) {
      data.due_date = input.due_date ? toDateValue(input.due_date) : null;
    }

    const updated = await tx.fee_structures.update({
      where: { id: existing.id },
      data
    });

    if (input.is_active !== undefined) {
      await tx.$executeRaw`UPDATE fee_structures SET is_active = ${input.is_active} WHERE id = ${existing.id}`;
    }

    return { ...formatFeeStructure(updated), is_active: input.is_active ?? true };
  });

  void logAction(null, AuditActorType.SYSTEM, "update", "fee_structures", result.id, {
    schoolId,
    resourceName: result.name,
    newValues: toAuditJsonObject(input as Record<string, unknown>)
  });

  return result;
};

export const deleteFeeStructure = async (
  schoolId: string | number | bigint,
  id: string
) => {
  const result = await prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid fee structure id", 400);
    }

    const existing = await tx.fee_structures.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      },
      include: {
        _count: { select: { student_fee_assignments: true } }
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Fee structure not found", 404);
    }

    if (existing._count.student_fee_assignments > 0) {
      throw new AppError(
        "conflict",
        "Cannot delete fee structure with existing student assignments",
        409
      );
    }

    await tx.fee_structures.delete({ where: { id: existing.id } });

    return formatFeeStructure(existing);
  });

  void logAction(null, AuditActorType.SYSTEM, "delete", "fee_structures", result.id, {
    schoolId,
    resourceName: result.name
  });

  return result;
};

export const cloneFeeStructureToTerm = async (
  schoolId: string | number | bigint,
  id: string,
  input: { term_id: string | number | bigint; academic_year_id?: string | number | bigint }
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid fee structure id", 400);
    }

    const source = await tx.fee_structures.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId)
      }
    });

    if (!source) {
      throw new AppError("not_found", "Fee structure not found", 404);
    }

    const academicYearId = input.academic_year_id
      ? toBigInt(input.academic_year_id)
      : source.academic_year_id;

    await assertAcademicYear(tx, schoolId, academicYearId);
    await assertTerm(tx, schoolId, input.term_id, academicYearId);

    const cloned = await tx.fee_structures.create({
      data: {
        school_id: source.school_id,
        academic_year_id: academicYearId,
        term_id: toBigInt(input.term_id),
        class_id: source.class_id,
        name: source.name,
        amount: source.amount,
        currency: source.currency,
        is_mandatory: source.is_mandatory,
        due_date: source.due_date
      }
    });

    const sourceActive = (source as fee_structures & { is_active?: boolean }).is_active ?? true;
    await tx.$executeRaw`UPDATE fee_structures SET is_active = ${sourceActive} WHERE id = ${cloned.id}`;

    return formatFeeStructure(cloned);
  });
