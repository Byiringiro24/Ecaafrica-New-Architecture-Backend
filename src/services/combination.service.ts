import type { Prisma } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

const toBigInt = (value: string | number | bigint) => typeof value === "bigint" ? value : BigInt(value);
const include = {
  subjects: { include: { subject: { select: { id: true, name: true, code: true, is_active: true } } } },
  classes: { include: { class_record: { select: { id: true, name: true } } } }
} as const;

const format = (row: any) => ({
  id: row.id.toString(), school_id: row.school_id.toString(), code: row.code, name: row.name,
  description: row.description, is_active: row.is_active,
  subjects: (row.subjects ?? []).map((item: any) => ({ ...item.subject, id: item.subject.id.toString() })),
  classes: (row.classes ?? []).map((item: any) => ({ ...item.class_record, id: item.class_record.id.toString() }))
});

const assertReferences = async (tx: Prisma.TransactionClient, schoolId: string | number | bigint, subjectIds: Array<string | number | bigint>, classIds: Array<string | number | bigint>) => {
  const school = toBigInt(schoolId);
  const subjects = await tx.subjects.findMany({ where: { id: { in: subjectIds.map(toBigInt) }, school_id: school, deleted_at: null }, select: { id: true } });
  if (subjects.length !== new Set(subjectIds.map(String)).size) throw new AppError("not_found", "One or more subjects were not found", 404);
  const classes = await tx.classes.findMany({ where: { id: { in: classIds.map(toBigInt) }, school_id: school, deleted_at: null }, select: { id: true } });
  if (classes.length !== new Set(classIds.map(String)).size) throw new AppError("not_found", "One or more classes were not found", 404);
};

const syncLinks = async (tx: Prisma.TransactionClient, schoolId: string | number | bigint, combinationId: bigint, subjectIds?: Array<string | number | bigint>, classIds?: Array<string | number | bigint>) => {
  const school = toBigInt(schoolId);
  if (subjectIds !== undefined) {
    await assertReferences(tx, schoolId, subjectIds, []);
    await tx.combination_subjects.deleteMany({ where: { combination_id: combinationId } });
    if (subjectIds.length) await tx.combination_subjects.createMany({ data: subjectIds.map((subject_id) => ({ school_id: school, combination_id: combinationId, subject_id: toBigInt(subject_id) })) });
  }
  if (classIds !== undefined) {
    await assertReferences(tx, schoolId, [], classIds);
    await tx.class_combinations.deleteMany({ where: { combination_id: combinationId } });
    if (classIds.length) await tx.class_combinations.createMany({ data: classIds.map((class_id) => ({ school_id: school, combination_id: combinationId, class_id: toBigInt(class_id) })) });
  }
};

export const listCombinations = async (schoolId: string | number | bigint, pagination: PaginationParams, includeDeleted = false) => {
  const where = { school_id: toBigInt(schoolId), deleted_at: includeDeleted ? undefined : null };
  const [rows, total] = await prisma.$transaction([
    prisma.subject_combinations.findMany({ where, include, orderBy: { code: "asc" }, skip: (pagination.page - 1) * pagination.limit, take: pagination.limit }),
    prisma.subject_combinations.count({ where })
  ]);
  return { data: rows.map(format), meta: { page: pagination.page, limit: pagination.limit, total } };
};

export const createCombination = async (schoolId: string | number | bigint, input: { code: string; name: string; description?: string | null; subject_ids?: Array<string | number>; class_ids?: Array<string | number> }) => prisma.$transaction(async (tx) => {
  const school = toBigInt(schoolId);
  const subjectIds = input.subject_ids ?? [];
  const classIds = input.class_ids ?? [];
  await assertReferences(tx, schoolId, subjectIds, classIds);
  const duplicate = await tx.subject_combinations.findFirst({ where: { school_id: school, code: input.code, deleted_at: null } });
  if (duplicate) throw new AppError("conflict", "A combination with this code already exists", 409);
  const row = await tx.subject_combinations.create({ data: { school_id: school, code: input.code, name: input.name, description: input.description ?? null } });
  await syncLinks(tx, schoolId, row.id, subjectIds, classIds);
  return format(await tx.subject_combinations.findUnique({ where: { id: row.id }, include }));
});

export const updateCombination = async (schoolId: string | number | bigint, id: string, input: Partial<{ code: string; name: string; description: string | null; subject_ids: Array<string | number>; class_ids: Array<string | number>; is_active: boolean }>) => prisma.$transaction(async (tx) => {
  if (!/^\d+$/.test(id)) throw new AppError("bad_request", "Invalid combination id", 400);
  const existing = await tx.subject_combinations.findFirst({ where: { id: toBigInt(id), school_id: toBigInt(schoolId), deleted_at: null } });
  if (!existing) throw new AppError("not_found", "Combination not found", 404);
  if (input.code && input.code !== existing.code) {
    const duplicate = await tx.subject_combinations.findFirst({ where: { school_id: toBigInt(schoolId), code: input.code, deleted_at: null, NOT: { id: existing.id } } });
    if (duplicate) throw new AppError("conflict", "A combination with this code already exists", 409);
  }
  await tx.subject_combinations.update({ where: { id: existing.id }, data: { code: input.code, name: input.name, description: input.description, is_active: input.is_active } });
  await syncLinks(tx, schoolId, existing.id, input.subject_ids, input.class_ids);
  return format(await tx.subject_combinations.findUnique({ where: { id: existing.id }, include }));
});

export const deleteCombination = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) throw new AppError("bad_request", "Invalid combination id", 400);
  const row = await prisma.subject_combinations.findFirst({ where: { id: toBigInt(id), school_id: toBigInt(schoolId), deleted_at: null } });
  if (!row) throw new AppError("not_found", "Combination not found", 404);
  return format(await prisma.subject_combinations.update({ where: { id: row.id }, data: { deleted_at: new Date() }, include }));
};
