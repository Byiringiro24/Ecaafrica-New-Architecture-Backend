import type { PaymentMethod, POStatus, Prisma, inventory_items } from "@prisma/client";
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

export const INVENTORY_CATEGORIES = [
  "Stationery", "Laboratory", "ICT Equipment", "Catering", "Cleaning", "Maintenance"
];

export const findInventoryCategories = async (schoolId: IdInput) => {
  const custom = await prisma.inventory_categories.findMany({
    where: { school_id: toBigInt(schoolId), is_active: true },
    orderBy: { name: "asc" },
    select: { name: true }
  });
  return Array.from(new Set([...INVENTORY_CATEGORIES, ...custom.map((category) => category.name)]));
};

export const createInventoryCategory = async (schoolId: IdInput, name: string) => {
  const normalized = name.trim();
  const existing = await prisma.inventory_categories.findFirst({
    where: { school_id: toBigInt(schoolId), name: { equals: normalized, mode: "insensitive" } }
  });
  if (existing || INVENTORY_CATEGORIES.some((category) => category.toLowerCase() === normalized.toLowerCase())) {
    throw new AppError("conflict", "An inventory category with this name already exists", 409);
  }

  const created = await prisma.inventory_categories.create({
    data: { school_id: toBigInt(schoolId), name: normalized }
  });
  return { id: created.id.toString(), school_id: created.school_id.toString(), name: created.name };
};

/**
 * A purchase request moves forward only. `cancelled` is reachable from any
 * non-terminal state; nothing is reachable out of `received`/`invoiced`/`cancelled`
 * so that goods-received and supplier-invoiced records stay auditable.
 */
const ALLOWED_TRANSITIONS: Record<POStatus, POStatus[]> = {
  requested: ["ordered", "cancelled"],
  ordered: ["received", "cancelled"],
  received: ["invoiced"],
  invoiced: [],
  cancelled: []
};

type InventoryCreateInput = {
  item_name: string;
  category?: string;
  supplier_id?: IdInput;
  quantity: number;
  unit_cost: string | number;
  currency?: string;
  reorder_level?: number;
  status?: POStatus;
  invoice_url?: string;
  notes?: string;
};

type InventoryUpdateInput = Partial<Omit<InventoryCreateInput, "status">>;

type InventoryFilters = {
  status?: POStatus;
  category?: string;
  supplier_id?: string;
  low_stock?: boolean;
};

const format = (
  record: inventory_items & { supplier?: { id: bigint; name: string } | null }
) => {
  const value = record.unit_cost.mul(record.quantity);

  return {
    id: record.id.toString(),
    school_id: record.school_id.toString(),
    code: record.code,
    item_name: record.item_name,
    category: record.category,
    supplier_id: record.supplier_id ? record.supplier_id.toString() : null,
    supplier_name: record.supplier?.name ?? null,
    quantity: record.quantity,
    unit_cost: record.unit_cost.toString(),
    total_value: value.toString(),
    currency: record.currency,
    reorder_level: record.reorder_level,
    is_low_stock: record.quantity < record.reorder_level,
    status: record.status,
    invoice_url: record.invoice_url,
    amount_paid: record.amount_paid.toString(),
    balance_due: value.sub(record.amount_paid).toString(),
    paid_at: record.paid_at,
    payment_method: record.payment_method,
    is_paid: record.amount_paid.gte(value),
    notes: record.notes,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
};

const assertSupplier = async (
  tx: Prisma.TransactionClient,
  schoolId: IdInput,
  supplierId: IdInput
) => {
  const supplier = await tx.suppliers.findFirst({
    where: { id: toBigInt(supplierId), school_id: toBigInt(schoolId), deleted_at: null }
  });

  if (!supplier) {
    throw new AppError("not_found", "Supplier not found", 404);
  }

  return supplier;
};

export const createInventoryItem = async (
  schoolId: IdInput,
  createdBy: IdInput | undefined,
  input: InventoryCreateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    if (input.supplier_id) {
      await assertSupplier(tx, schoolId, input.supplier_id);
    }

    const count = await tx.inventory_items.count({
      where: { school_id: toBigInt(schoolId) }
    });

    const created = await tx.inventory_items.create({
      data: {
        school_id: toBigInt(schoolId),
        code: `INV-${String(count + 101).padStart(3, "0")}`,
        item_name: input.item_name,
        category: input.category,
        supplier_id: input.supplier_id ? toBigInt(input.supplier_id) : undefined,
        quantity: input.quantity,
        unit_cost: toDecimal(input.unit_cost),
        currency: input.currency ?? "RWF",
        reorder_level: input.reorder_level ?? 0,
        status: input.status ?? "requested",
        invoice_url: input.invoice_url,
        notes: input.notes,
        created_by: createdBy ? toBigInt(createdBy) : undefined
      },
      include: { supplier: { select: { id: true, name: true } } }
    });

    if (input.supplier_id) {
      await tx.suppliers.update({
        where: { id: toBigInt(input.supplier_id) },
        data: { balance: { increment: toDecimal(String(Number(input.unit_cost) * input.quantity)) } }
      });
    }

    return format(created);
  });

  void logAction(
    createdBy ?? null,
    AuditActorType.SCHOOL_USER,
    "create",
    "inventory_items",
    result.id,
    { schoolId, resourceName: result.item_name, newValues: toAuditJson({ ...input }) }
  );

  return result;
};

export const findAllInventoryItems = async (
  schoolId: IdInput,
  pagination: PaginationParams,
  filters: InventoryFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.inventory_itemsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null
  };

  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.supplier_id) where.supplier_id = toBigInt(filters.supplier_id);

  if (q) {
    where.OR = [
      { item_name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.inventory_items.findMany({
      where,
      orderBy: resolveOrderBy<Prisma.inventory_itemsOrderByWithRelationInput>(
        ["item_name", "quantity", "unit_cost", "created_at", "status"],
        sort,
        order,
        "created_at"
      ),
      skip: (page - 1) * limit,
      take: limit,
      include: { supplier: { select: { id: true, name: true } } }
    }),
    prisma.inventory_items.count({ where })
  ]);

  const formatted = items.map(format);

  // quantity < reorder_level is a cross-column comparison, which Prisma cannot
  // express in `where`; filter and total it after formatting.
  const data = filters.low_stock ? formatted.filter((i) => i.is_low_stock) : formatted;

  const allForTotals = await prisma.inventory_items.findMany({
    where,
    select: { quantity: true, unit_cost: true, reorder_level: true }
  });

  const stockValue = allForTotals.reduce(
    (sum, i) => sum + Number(i.unit_cost) * i.quantity,
    0
  );
  const lowStockCount = allForTotals.filter((i) => i.quantity < i.reorder_level).length;

  return {
    data,
    meta: {
      page,
      limit,
      total: filters.low_stock ? data.length : total,
      stock_value: stockValue.toFixed(2),
      low_stock_count: lowStockCount
    }
  };
};

export const findInventoryItemById = async (schoolId: IdInput, id: string) => {
  const record = await prisma.inventory_items.findFirst({
    where: { id: parseId(id, "inventory item"), school_id: toBigInt(schoolId), deleted_at: null },
    include: { supplier: { select: { id: true, name: true } } }
  });

  if (!record) {
    throw new AppError("not_found", "Inventory item not found", 404);
  }

  return format(record);
};

export const paySupplier = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: { amount: string | number; payment_method: PaymentMethod }
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.inventory_items.findFirst({
      where: { id: parseId(id, "inventory item"), school_id: toBigInt(schoolId), deleted_at: null },
      include: { supplier: true }
    });
    if (!existing) throw new AppError("not_found", "Inventory item not found", 404);
    if (!existing.supplier) throw new AppError("bad_request", "Assign a supplier before making a payment", 400);

    const amount = Number(input.amount);
    const remaining = Number(existing.unit_cost) * existing.quantity - Number(existing.amount_paid);
    if (amount > remaining + 0.001) throw new AppError("bad_request", "Payment exceeds this item's outstanding balance", 400);
    if (amount > Number(existing.supplier.balance) + 0.001) throw new AppError("bad_request", "Payment exceeds the supplier's outstanding balance", 400);

    const updated = await tx.inventory_items.update({
      where: { id: existing.id },
      data: { amount_paid: { increment: toDecimal(String(amount)) }, paid_at: new Date(), payment_method: input.payment_method },
      include: { supplier: { select: { id: true, name: true } } }
    });
    await tx.suppliers.update({ where: { id: existing.supplier.id }, data: { balance: { decrement: toDecimal(String(amount)) } } });
    return format(updated);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "pay_supplier", "inventory_items", result.id, {
    schoolId, resourceName: result.item_name, newValues: toAuditJson(input)
  });
  return result;
};

export const updateInventoryItem = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: InventoryUpdateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.inventory_items.findFirst({
      where: { id: parseId(id, "inventory item"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Inventory item not found", 404);
    }

    if (input.supplier_id) {
      await assertSupplier(tx, schoolId, input.supplier_id);
    }

    const data: Prisma.inventory_itemsUncheckedUpdateInput = {};
    if (input.item_name !== undefined) data.item_name = input.item_name;
    if (input.category !== undefined) data.category = input.category;
    if (input.supplier_id !== undefined) data.supplier_id = toBigInt(input.supplier_id);
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.unit_cost !== undefined) data.unit_cost = toDecimal(input.unit_cost);
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.reorder_level !== undefined) data.reorder_level = input.reorder_level;
    if (input.invoice_url !== undefined) data.invoice_url = input.invoice_url;
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await tx.inventory_items.update({
      where: { id: existing.id },
      data,
      include: { supplier: { select: { id: true, name: true } } }
    });

    return format(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "update",
    "inventory_items",
    result.id,
    { schoolId, resourceName: result.item_name, newValues: toAuditJson({ ...input }) }
  );

  return result;
};

export const updateInventoryStatus = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  status: POStatus
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.inventory_items.findFirst({
      where: { id: parseId(id, "inventory item"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Inventory item not found", 404);
    }

    const allowed = ALLOWED_TRANSITIONS[existing.status];
    if (!allowed.includes(status)) {
      throw new AppError(
        "conflict",
        `Cannot move a purchase request from "${existing.status}" to "${status}"`,
        409
      );
    }

    const updated = await tx.inventory_items.update({
      where: { id: existing.id },
      data: { status },
      include: { supplier: { select: { id: true, name: true } } }
    });

    return format(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    `status_${status}`,
    "inventory_items",
    result.id,
    { schoolId, resourceName: result.item_name }
  );

  return result;
};

export const deleteInventoryItem = async (
  schoolId: IdInput,
  id: string,
  actorId?: IdInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.inventory_items.findFirst({
      where: { id: parseId(id, "inventory item"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Inventory item not found", 404);
    }

    const deleted = await tx.inventory_items.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() },
      include: { supplier: { select: { id: true, name: true } } }
    });

    return format(deleted);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "delete",
    "inventory_items",
    result.id,
    { schoolId, resourceName: result.item_name }
  );

  return result;
};

export const attachInventoryInvoice = async (
  schoolId: IdInput,
  id: string,
  invoiceUrl: string
) => {
  const existing = await prisma.inventory_items.findFirst({
    where: { id: parseId(id, "inventory item"), school_id: toBigInt(schoolId), deleted_at: null }
  });

  if (!existing) {
    throw new AppError("not_found", "Inventory item not found", 404);
  }

  const updated = await prisma.inventory_items.update({
    where: { id: existing.id },
    data: { invoice_url: invoiceUrl },
    include: { supplier: { select: { id: true, name: true } } }
  });

  return format(updated);
};
