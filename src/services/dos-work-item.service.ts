import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma";
import { parsePagination } from "../helpers/pagination";
import { AppError } from "../middleware/errorHandler";
import { logAction } from "./audit.service";

const bigint = (value: string | number | bigint) => BigInt(value);
const format = (row: any) => ({
  ...row,
  id: row.id.toString(),
  school_id: row.school_id.toString(),
  student_id: row.student_id?.toString() ?? null,
  created_by: row.created_by?.toString() ?? null,
  updated_by: row.updated_by?.toString() ?? null
});

export type DosActor = { id?: string | number | bigint; role?: string; name?: string };

export async function listDosWorkItems(schoolId: string | number | bigint, input: any) {
  const pagination = parsePagination((input ?? {}) as Record<string, string | string[] | undefined | null>);
  const page = pagination.page;
  const limit = pagination.limit;

  const where: Prisma.dos_work_itemsWhereInput = { school_id: bigint(schoolId) };
  if (input.type) where.type = input.type;
  if (input.status) where.status = input.status;
  if (input.student_id) where.student_id = bigint(input.student_id);
  if (input.search) where.title = { contains: input.search, mode: "insensitive" };

  const [items, total] = await prisma.$transaction([
    prisma.dos_work_items.findMany({
      where,
      orderBy: { updated_at: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.dos_work_items.count({ where })
  ]);

  return { data: items.map(format), meta: { page, limit, total } };
}

export async function getDosWorkItem(schoolId: string | number | bigint, id: string) {
  const row = await prisma.dos_work_items.findFirst({ where: { id: bigint(id), school_id: bigint(schoolId) } });
  if (!row) throw new AppError("not_found", "DOS work item not found", 404);
  return format(row);
}

export async function createDosWorkItem(schoolId: string | number | bigint, input: any, actor: DosActor) {
  const row = await prisma.dos_work_items.create({ data: {
    school_id: bigint(schoolId), type: input.type, title: input.title,
    status: input.status ?? "open", priority: input.priority ?? "normal",
    student_id: input.student_id ? bigint(input.student_id) : null,
    payload: input.payload as Prisma.InputJsonValue,
    created_by: actor.id ? bigint(actor.id) : null, updated_by: actor.id ? bigint(actor.id) : null
  }});
  await logAction(actor.id ?? null, "school_user", "create", "dos_work_item", row.id, { schoolId, actorName: actor.name, newValues: input.payload as Prisma.InputJsonValue });
  return format(row);
}

export async function updateDosWorkItem(schoolId: string | number | bigint, id: string, input: any, actor: DosActor) {
  const existing = await prisma.dos_work_items.findFirst({ where: { id: bigint(id), school_id: bigint(schoolId) } });
  if (!existing) throw new AppError("not_found", "DOS work item not found", 404);
  const row = await prisma.dos_work_items.update({ where: { id: existing.id }, data: {
    type: input.type, title: input.title, status: input.status, priority: input.priority,
    student_id: input.student_id === undefined ? undefined : input.student_id ? bigint(input.student_id) : null,
    payload: input.payload as Prisma.InputJsonValue | undefined,
    updated_by: actor.id ? bigint(actor.id) : null
  }});
  await logAction(actor.id ?? null, "school_user", "update", "dos_work_item", row.id, { schoolId, actorName: actor.name, oldValues: existing.payload as Prisma.InputJsonValue, newValues: (input.payload ?? existing.payload) as Prisma.InputJsonValue });
  return format(row);
}

export async function deleteDosWorkItem(schoolId: string | number | bigint, id: string, actor: DosActor) {
  const existing = await prisma.dos_work_items.findFirst({ where: { id: bigint(id), school_id: bigint(schoolId) } });
  if (!existing) throw new AppError("not_found", "DOS work item not found", 404);
  await prisma.dos_work_items.delete({ where: { id: existing.id } });
  await logAction(actor.id ?? null, "school_user", "delete", "dos_work_item", existing.id, { schoolId, actorName: actor.name, oldValues: existing.payload as Prisma.InputJsonValue });
  return { id };
}

export async function getDosWorkItemSummary(schoolId: string | number | bigint) {
  const grouped = await prisma.dos_work_items.groupBy({ by: ["type", "status"], where: { school_id: bigint(schoolId) }, _count: { _all: true } });
  return grouped.map(item => ({ type: item.type, status: item.status, count: item._count._all }));
}
