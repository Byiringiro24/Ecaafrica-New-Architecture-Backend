import type { Prisma, subscription_plans } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

type PlanCreateInput = {
  name: string;
  price_monthly?: number | string;
  price_annual?: number | string;
  student_limit?: number;
  staff_limit?: number;
  sms_bundle?: number;
  features?: Prisma.InputJsonValue | null;
  is_active?: boolean;
  sort_order?: number;
};

type PlanUpdateInput = Partial<PlanCreateInput>;

type PlanFilters = {
  is_active?: boolean;
  include_deleted?: boolean;
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

const formatPlan = (plan: subscription_plans) => ({
  ...plan,
  id: plan.id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "name", "sort_order"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.subscription_plansOrderByWithRelationInput;
  }

  return { sort_order: "asc" } as Prisma.subscription_plansOrderByWithRelationInput;
};

export const createPlan = async (input: PlanCreateInput) => {
  const created = await prisma.subscription_plans.create({
    data: {
      name: input.name,
      price_monthly: input.price_monthly ?? undefined,
      price_annual: input.price_annual ?? undefined,
      student_limit: input.student_limit ?? undefined,
      staff_limit: input.staff_limit ?? undefined,
      sms_bundle: input.sms_bundle ?? undefined,
      features: input.features ?? undefined,
      is_active: input.is_active ?? undefined,
      sort_order: input.sort_order ?? undefined
    }
  });

  return formatPlan(created);
};

export const findAllPlans = async (
  pagination: PaginationParams,
  filters: PlanFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.subscription_plansWhereInput = {
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.subscription_plans.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.subscription_plans.count({ where })
  ]);

  return {
    data: items.map((item) => formatPlan(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findPlanById = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid plan id", 400);
  }

  const plan = await prisma.subscription_plans.findFirst({
    where: {
      id: toBigInt(id),
      deleted_at: null
    }
  });

  if (!plan) {
    throw new AppError("not_found", "Plan not found", 404);
  }

  return formatPlan(plan);
};

export const updatePlan = async (id: string, input: PlanUpdateInput) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid plan id", 400);
  }

  const existing = await prisma.subscription_plans.findFirst({
    where: {
      id: toBigInt(id),
      deleted_at: null
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Plan not found", 404);
  }

  const updated = await prisma.subscription_plans.update({
    where: { id: existing.id },
    data: {
      name: input.name ?? undefined,
      price_monthly: input.price_monthly ?? undefined,
      price_annual: input.price_annual ?? undefined,
      student_limit: input.student_limit ?? undefined,
      staff_limit: input.staff_limit ?? undefined,
      sms_bundle: input.sms_bundle ?? undefined,
      features: input.features ?? undefined,
      is_active: input.is_active ?? undefined,
      sort_order: input.sort_order ?? undefined
    }
  });

  return formatPlan(updated);
};

export const softDeletePlan = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid plan id", 400);
  }

  const existing = await prisma.subscription_plans.findFirst({
    where: {
      id: toBigInt(id),
      deleted_at: null
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Plan not found", 404);
  }

  const deleted = await prisma.subscription_plans.update({
    where: { id: existing.id },
    data: { deleted_at: new Date() }
  });

  return formatPlan(deleted);
};
