import type { Prisma, suppliers } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AuditActorType } from "../../constants/enums";
import type { PaginationParams } from "../../helpers/pagination";
import { AppError } from "../../middleware/errorHandler";
import { logAction } from "../audit.service";
import {
  parseId,
  resolveOrderBy,
  toAuditJson,
  toBigInt,
  toDecimal,
  type IdInput
} from "./shared";

type SupplierCreateInput = {
  name: string;
  country_code?: string;
  tin_number?: string;
  category?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  balance?: string | number;
};

type SupplierUpdateInput = Partial<SupplierCreateInput> & { is_active?: boolean };

type SupplierFilters = {
  category?: string;
  is_active?: boolean;
};

const format = (
  record: suppliers & { _count?: { inventory_items: number } }
) => ({
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  code: record.code,
  name: record.name,
  country_code: record.country_code,
  tin_number: record.tin_number,
  category: record.category,
  contact_person: record.contact_person,
  phone: record.phone,
  email: record.email,
  address: record.address,
  balance: record.balance.toString(),
  is_active: record.is_active,
  inventory_item_count: record._count?.inventory_items ?? undefined,
  created_at: record.created_at,
  updated_at: record.updated_at
});

export const createSupplier = async (
  schoolId: IdInput,
  actorId: IdInput | undefined,
  input: SupplierCreateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.suppliers.count({
      where: { school_id: toBigInt(schoolId) }
    });

    const created = await tx.suppliers.create({
      data: {
        school_id: toBigInt(schoolId),
        code: `SUP-${String(count + 1).padStart(3, "0")}`,
        name: input.name,
        country_code: input.country_code?.toUpperCase(),
        tin_number: input.tin_number,
        category: input.category,
        contact_person: input.contact_person,
        phone: input.phone,
        email: input.email,
        address: input.address,
        balance: input.balance !== undefined ? toDecimal(input.balance) : undefined
      }
    });

    return format(created);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "create", "suppliers", result.id, {
    schoolId,
    resourceName: result.name,
    newValues: toAuditJson({ ...input })
  });

  return result;
};

export const findAllSuppliers = async (
  schoolId: IdInput,
  pagination: PaginationParams,
  filters: SupplierFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.suppliersWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null
  };

  if (filters.category) where.category = filters.category;
  if (filters.is_active !== undefined) where.is_active = filters.is_active;

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { contact_person: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total, payable] = await prisma.$transaction([
    prisma.suppliers.findMany({
      where,
      orderBy: resolveOrderBy<Prisma.suppliersOrderByWithRelationInput>(
        ["name", "balance", "created_at", "category"],
        sort,
        order,
        "name"
      ),
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { inventory_items: true } } }
    }),
    prisma.suppliers.count({ where }),
    prisma.suppliers.aggregate({ where, _sum: { balance: true } })
  ]);

  return {
    data: items.map(format),
    meta: {
      page,
      limit,
      total,
      total_payable: payable._sum.balance?.toString() ?? "0"
    }
  };
};

export const findSupplierById = async (schoolId: IdInput, id: string) => {
  const record = await prisma.suppliers.findFirst({
    where: { id: parseId(id, "supplier"), school_id: toBigInt(schoolId), deleted_at: null },
    include: { _count: { select: { inventory_items: true } } }
  });

  if (!record) {
    throw new AppError("not_found", "Supplier not found", 404);
  }

  return format(record);
};

export const updateSupplier = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: SupplierUpdateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.suppliers.findFirst({
      where: { id: parseId(id, "supplier"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Supplier not found", 404);
    }

    const data: Prisma.suppliersUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.country_code !== undefined) data.country_code = input.country_code.toUpperCase();
    if (input.tin_number !== undefined) data.tin_number = input.tin_number;
    if (input.category !== undefined) data.category = input.category;
    if (input.contact_person !== undefined) data.contact_person = input.contact_person;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.address !== undefined) data.address = input.address;
    if (input.balance !== undefined) data.balance = toDecimal(input.balance);
    if (input.is_active !== undefined) data.is_active = input.is_active;

    const updated = await tx.suppliers.update({ where: { id: existing.id }, data });
    return format(updated);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "update", "suppliers", result.id, {
    schoolId,
    resourceName: result.name,
    newValues: toAuditJson({ ...input })
  });

  return result;
};

export const deleteSupplier = async (
  schoolId: IdInput,
  id: string,
  actorId?: IdInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.suppliers.findFirst({
      where: { id: parseId(id, "supplier"), school_id: toBigInt(schoolId), deleted_at: null },
      include: { _count: { select: { inventory_items: true } } }
    });

    if (!existing) {
      throw new AppError("not_found", "Supplier not found", 404);
    }

    if (existing._count.inventory_items > 0) {
      throw new AppError(
        "conflict",
        "Cannot delete a supplier that has inventory items",
        409
      );
    }

    const deleted = await tx.suppliers.update({
      where: { id: existing.id },
      data: { deleted_at: new Date(), is_active: false }
    });

    return format(deleted);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "delete", "suppliers", result.id, {
    schoolId,
    resourceName: result.name
  });

  return result;
};
