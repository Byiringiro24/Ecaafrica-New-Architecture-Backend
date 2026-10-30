import type { AuditActorType, AuditSeverity, Prisma } from "@prisma/client";
import { prisma } from "../database/prisma";
import { AuditActorType as AuditActorTypeConst } from "../constants/enums";

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

export type AuditMetadata = {
  schoolId?: string | number | bigint | null;
  actorName?: string;
  resourceName?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
};

const formatAuditLog = (record: {
  id: bigint;
  school_id: bigint | null;
  actor_type: AuditActorType;
  actor_id: bigint | null;
  actor_name: string | null;
  action: string;
  resource_type: string;
  resource_id: bigint | null;
  resource_name: string | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  user_agent: string | null;
  severity: AuditSeverity;
  created_at: Date;
}) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id ? record.school_id.toString() : null,
  actor_id: record.actor_id ? record.actor_id.toString() : null,
  resource_id: record.resource_id ? record.resource_id.toString() : null
});

export const logAction = async (
  actorId: string | number | bigint | null,
  actorType: AuditActorType | string,
  action: string,
  resource: string,
  resourceId?: string | number | bigint | null,
  metadata: AuditMetadata = {}
) => {
  const record = await prisma.audit_logs.create({
    data: {
      school_id:
        metadata.schoolId !== undefined && metadata.schoolId !== null
          ? toBigInt(metadata.schoolId)
          : null,
      actor_type: actorType as AuditActorType,
      actor_id: actorId !== null && actorId !== undefined ? toBigInt(actorId) : null,
      actor_name: metadata.actorName ?? null,
      action,
      resource_type: resource,
      resource_id:
        resourceId !== undefined && resourceId !== null ? toBigInt(resourceId) : null,
      resource_name: metadata.resourceName ?? null,
      old_values: metadata.oldValues ?? undefined,
      new_values: metadata.newValues ?? undefined,
      ip_address: metadata.ipAddress ?? null,
      user_agent: metadata.userAgent ?? null,
      severity: metadata.severity ?? "info"
    }
  });

  return formatAuditLog(record);
};

export type AuditLogFilters = {
  actor_id?: string;
  actor_type?: string;
  action?: string;
  resource_type?: string;
  severity?: string;
  school_id?: string | number | bigint;
  from?: string | Date;
  to?: string | Date;
};

export const findAuditLogs = async (
  pagination: { page: number; limit: number; sort?: string; order?: "asc" | "desc" },
  filters: AuditLogFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.audit_logsWhereInput = {};

  if (filters.school_id !== undefined) {
    where.school_id = toBigInt(filters.school_id);
  }

  if (filters.actor_id) {
    where.actor_id = toBigInt(filters.actor_id);
  }

  if (filters.actor_type) {
    where.actor_type = filters.actor_type as AuditActorType;
  }

  if (filters.action) {
    where.action = { contains: filters.action, mode: "insensitive" };
  }

  if (filters.resource_type) {
    where.resource_type = filters.resource_type;
  }

  if (filters.severity) {
    where.severity = filters.severity as AuditSeverity;
  }

  if (filters.from || filters.to) {
    where.created_at = {};
    if (filters.from) {
      where.created_at.gte =
        filters.from instanceof Date ? filters.from : new Date(filters.from);
    }
    if (filters.to) {
      where.created_at.lte =
        filters.to instanceof Date ? filters.to : new Date(filters.to);
    }
  }

  const orderBy: Prisma.audit_logsOrderByWithRelationInput =
    sort === "created_at" || sort === "severity" || sort === "action"
      ? { [sort]: order ?? "desc" }
      : { created_at: "desc" };

  const [items, total] = await prisma.$transaction([
    prisma.audit_logs.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.audit_logs.count({ where })
  ]);

  return {
    data: items.map(formatAuditLog),
    meta: { page, limit, total }
  };
};

export const logSystemAction = (
  action: string,
  resource: string,
  resourceId?: string | number | bigint | null,
  metadata?: AuditMetadata
) =>
  logAction(null, AuditActorTypeConst.SYSTEM, action, resource, resourceId, metadata);
