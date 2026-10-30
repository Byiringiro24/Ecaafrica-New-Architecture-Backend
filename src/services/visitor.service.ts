import { type Prisma, type VisitorType, type visitors } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type VisitorCreateInput = {
  full_name: string;
  phone: string;
  email?: string;
  national_id?: string;
  organization?: string;
  visitor_type?: VisitorType;
};

type VisitorUpdateInput = Partial<VisitorCreateInput>;

type VisitorFilters = {
  visitor_type?: VisitorType;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatVisitor = (record: visitors) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "full_name"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.visitorsOrderByWithRelationInput;
  }
  return { created_at: "desc" } as Prisma.visitorsOrderByWithRelationInput;
};

export const createVisitor = async (
  schoolId: string | number | bigint,
  input: VisitorCreateInput
) => {
  const created = await prisma.visitors.create({
    data: {
      school_id: toBigInt(schoolId),
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      national_id: input.national_id,
      organization: input.organization,
      visitor_type: input.visitor_type
    }
  });

  return formatVisitor(created);
};

export const findAllVisitors = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: VisitorFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.visitorsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.visitor_type) where.visitor_type = filters.visitor_type;

  if (q) {
    where.OR = [
      { full_name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { organization: { contains: q, mode: "insensitive" } },
      { national_id: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.visitors.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.visitors.count({ where })
  ]);

  return {
    data: items.map(formatVisitor),
    meta: { page, limit, total }
  };
};

export const findVisitorById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid visitor id", 400);
  }

  const record = await prisma.visitors.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!record) {
    throw new AppError("not_found", "Visitor not found", 404);
  }

  return formatVisitor(record);
};

export const updateVisitor = async (
  schoolId: string | number | bigint,
  id: string,
  input: VisitorUpdateInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid visitor id", 400);
  }

  const existing = await prisma.visitors.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Visitor not found", 404);
  }

  const updated = await prisma.visitors.update({
    where: { id: existing.id },
    data: {
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      national_id: input.national_id,
      organization: input.organization,
      visitor_type: input.visitor_type
    }
  });

  return formatVisitor(updated);
};

export const deleteVisitor = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid visitor id", 400);
  }

  const existing = await prisma.visitors.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      _count: {
        select: {
          visitor_appointments: true,
          visitor_visits: true
        }
      }
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Visitor not found", 404);
  }

  if (existing._count.visitor_appointments > 0 || existing._count.visitor_visits > 0) {
    throw new AppError(
      "conflict",
      "Cannot delete visitor with appointments or visit records",
      409
    );
  }

  await prisma.visitors.delete({ where: { id: existing.id } });

  return formatVisitor(existing);
};
