import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import type { PaginationParams } from "../../helpers/pagination";
import { dateRangeFilter, toBigInt, type IdInput } from "./shared";

/**
 * Resource types written by the finance modules. The Finance audit page shows
 * activity across all of them, which the generic /audit-logs endpoint cannot
 * express because it filters on a single resource_type.
 */
export const FINANCE_RESOURCE_TYPES = [
  "fee_structures",
  "student_fee_assignments",
  "fee_transactions",
  "student_invoices",
  "expenses",
  "suppliers",
  "inventory_items",
  "payroll_runs",
  "payslips",
  "salary_records"
] as const;

const MODULE_BY_RESOURCE: Record<string, string> = {
  fee_structures: "Fee Structure",
  student_fee_assignments: "Fee Structure",
  fee_transactions: "Payments",
  student_invoices: "Invoicing",
  expenses: "Expenses",
  suppliers: "Inventory",
  inventory_items: "Inventory",
  payroll_runs: "Payroll",
  payslips: "Payroll",
  salary_records: "Payroll"
};

type AuditFilters = {
  module?: string;
  resource_type?: string;
  actor_id?: string;
  action?: string;
  from_date?: string;
  to_date?: string;
};

const resourceTypesForModule = (module: string) =>
  Object.entries(MODULE_BY_RESOURCE)
    .filter(([, name]) => name.toLowerCase() === module.toLowerCase())
    .map(([resource]) => resource);

export const findFinanceAuditLogs = async (
  schoolId: IdInput,
  pagination: PaginationParams,
  filters: AuditFilters = {}
) => {
  const { page, limit, order, q } = pagination;

  let resourceTypes: string[] = [...FINANCE_RESOURCE_TYPES];

  if (filters.module) {
    const scoped = resourceTypesForModule(filters.module);
    resourceTypes = scoped.length > 0 ? scoped : [];
  }

  if (filters.resource_type) {
    resourceTypes = resourceTypes.filter((r) => r === filters.resource_type);
  }

  const where: Prisma.audit_logsWhereInput = {
    school_id: toBigInt(schoolId),
    resource_type: { in: resourceTypes }
  };

  if (filters.actor_id) where.actor_id = toBigInt(filters.actor_id);
  if (filters.action) {
    where.action = { contains: filters.action, mode: "insensitive" };
  }

  const range = dateRangeFilter(filters.from_date, filters.to_date);
  if (range) where.created_at = range;

  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { resource_name: { contains: q, mode: "insensitive" } },
      { actor_name: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total, moduleCounts] = await Promise.all([
    prisma.audit_logs.findMany({
      where,
      orderBy: { created_at: order ?? "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.audit_logs.count({ where }),
    prisma.audit_logs.groupBy({
      by: ["resource_type"],
      where: {
        school_id: toBigInt(schoolId),
        resource_type: { in: [...FINANCE_RESOURCE_TYPES] }
      },
      _count: true,
      orderBy: { resource_type: "asc" }
    })
  ]);

  const modulesTracked = new Set(
    moduleCounts.map((row) => MODULE_BY_RESOURCE[row.resource_type]).filter(Boolean)
  );

  // audit_logs has no FK to users, and actor_name is only populated when a
  // caller passes it explicitly. Resolve the names for this page of results so
  // the "Performed By" column is never blank.
  const actorIds = [...new Set(items.map((i) => i.actor_id).filter(Boolean))] as bigint[];
  const actors = actorIds.length
    ? await prisma.users.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, role: true }
      })
    : [];
  const actorById = new Map(actors.map((a) => [a.id.toString(), a]));

  return {
    data: items.map((record) => {
      const actor = record.actor_id ? actorById.get(record.actor_id.toString()) : undefined;

      return {
        id: record.id.toString(),
        action: record.action,
        module: MODULE_BY_RESOURCE[record.resource_type] ?? record.resource_type,
        resource_type: record.resource_type,
        resource_id: record.resource_id ? record.resource_id.toString() : null,
        entity: record.resource_name,
        performed_by: record.actor_name ?? actor?.name ?? null,
        role: actor?.role ?? null,
        actor_id: record.actor_id ? record.actor_id.toString() : null,
        actor_type: record.actor_type,
        severity: record.severity,
        ip_address: record.ip_address,
        old_values: record.old_values,
        new_values: record.new_values,
        timestamp: record.created_at
      };
    }),
    meta: {
      page,
      limit,
      total,
      modules_tracked: modulesTracked.size,
      by_module: moduleCounts.map((row) => ({
        module: MODULE_BY_RESOURCE[row.resource_type] ?? row.resource_type,
        resource_type: row.resource_type,
        count: row._count
      }))
    }
  };
};

export const listFinanceModules = () =>
  Array.from(new Set(Object.values(MODULE_BY_RESOURCE))).sort();
