import type {
  BillingCycle,
  Prisma,
  SchoolSubscriptionStatus,
  school_subscriptions,
  schools,
  subscription_plans
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

type SubscriptionCreateInput = {
  school_id: string | number | bigint;
  plan_id: string | number | bigint;
  billing_cycle?: string;
  amount: number | string;
  currency?: string;
  status?: string;
  starts_at: string | Date;
  ends_at?: string | Date | null;
  trial_ends_at?: string | Date | null;
  grace_ends_at?: string | Date | null;
  auto_renew?: boolean;
  cancelled_at?: string | Date | null;
  cancellation_reason?: string | null;
  notes?: string | null;
  created_by?: string | number | bigint | null;
};

type SubscriptionUpdateInput = Partial<SubscriptionCreateInput>;

type SubscriptionFilters = {
  status?: string;
  school_id?: string;
  plan_id?: string;
};

type SubscriptionRecord = school_subscriptions & {
  school?: schools;
  plan?: subscription_plans;
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

const toDateValue = (value: string | Date | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

const formatSubscription = (subscription: SubscriptionRecord) => ({
  ...subscription,
  id: subscription.id.toString(),
  school_id: subscription.school_id.toString(),
  plan_id: subscription.plan_id.toString(),
  created_by: subscription.created_by ? subscription.created_by.toString() : null,
  school: subscription.school
    ? {
        ...subscription.school,
        id: subscription.school.id.toString(),
        subscription_plan_id: subscription.school.subscription_plan_id
          ? subscription.school.subscription_plan_id.toString()
          : null
      }
    : undefined,
  plan: subscription.plan
    ? { ...subscription.plan, id: subscription.plan.id.toString() }
    : undefined
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "starts_at", "ends_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.school_subscriptionsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.school_subscriptionsOrderByWithRelationInput;
};

export const createSubscription = async (input: SubscriptionCreateInput) => {
  const created = await prisma.school_subscriptions.create({
    data: {
      school_id: toBigInt(input.school_id),
      plan_id: toBigInt(input.plan_id),
      billing_cycle: (input.billing_cycle as BillingCycle) ?? undefined,
      amount: input.amount,
      currency: input.currency ?? undefined,
      status: (input.status as SchoolSubscriptionStatus) ?? undefined,
      starts_at: toDateValue(input.starts_at) as Date,
      ends_at: toDateValue(input.ends_at) ?? undefined,
      trial_ends_at: toDateValue(input.trial_ends_at) ?? undefined,
      grace_ends_at: toDateValue(input.grace_ends_at) ?? undefined,
      auto_renew: input.auto_renew ?? undefined,
      cancelled_at: toDateValue(input.cancelled_at) ?? undefined,
      cancellation_reason: input.cancellation_reason ?? undefined,
      notes: input.notes ?? undefined,
      created_by:
        input.created_by !== undefined && input.created_by !== null
          ? toBigInt(input.created_by)
          : undefined
    },
    include: {
      school: true,
      plan: true
    }
  });

  return formatSubscription(created);
};

export const findAllSubscriptions = async (
  pagination: PaginationParams,
  filters: SubscriptionFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.school_subscriptionsWhereInput = {};

  if (filters.status) where.status = filters.status as SchoolSubscriptionStatus;
  if (filters.school_id) where.school_id = toBigInt(filters.school_id);
  if (filters.plan_id) where.plan_id = toBigInt(filters.plan_id);

  if (q) {
    where.OR = [{ notes: { contains: q, mode: "insensitive" } }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.school_subscriptions.findMany({
      where,
      include: { school: true, plan: true },
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.school_subscriptions.count({ where })
  ]);

  return {
    data: items.map((item) => formatSubscription(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findSubscriptionById = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid subscription id", 400);
  }

  const subscription = await prisma.school_subscriptions.findFirst({
    where: { id: toBigInt(id) },
    include: { school: true, plan: true }
  });

  if (!subscription) {
    throw new AppError("not_found", "Subscription not found", 404);
  }

  return formatSubscription(subscription);
};

export const updateSubscription = async (id: string, input: SubscriptionUpdateInput) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid subscription id", 400);
  }

  const existing = await prisma.school_subscriptions.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Subscription not found", 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const subscription = await tx.school_subscriptions.update({
      where: { id: existing.id },
      data: {
        school_id: input.school_id ? toBigInt(input.school_id) : undefined,
        plan_id: input.plan_id ? toBigInt(input.plan_id) : undefined,
        billing_cycle: input.billing_cycle
          ? (input.billing_cycle as BillingCycle)
          : undefined,
        amount: input.amount ?? undefined,
        currency: input.currency ?? undefined,
        status: input.status
          ? (input.status as SchoolSubscriptionStatus)
          : undefined,
        starts_at: input.starts_at ? (toDateValue(input.starts_at) as Date) : undefined,
        ends_at: toDateValue(input.ends_at),
        trial_ends_at: toDateValue(input.trial_ends_at),
        grace_ends_at: toDateValue(input.grace_ends_at),
        auto_renew: input.auto_renew ?? undefined,
        cancelled_at: toDateValue(input.cancelled_at),
        cancellation_reason: input.cancellation_reason ?? undefined,
        notes: input.notes ?? undefined,
        created_by:
          input.created_by !== undefined && input.created_by !== null
            ? toBigInt(input.created_by)
            : undefined
      },
      include: { school: true, plan: true }
    });

    if (input.plan_id !== undefined) {
      await tx.schools.update({
        where: { id: existing.school_id },
        data: { subscription_plan_id: toBigInt(input.plan_id) }
      });
    }

    return subscription;
  });

  return formatSubscription(updated);
};

export const deleteSubscription = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid subscription id", 400);
  }

  const existing = await prisma.school_subscriptions.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Subscription not found", 404);
  }

  const deleted = await prisma.school_subscriptions.delete({
    where: { id: existing.id },
    include: { school: true, plan: true }
  });

  return formatSubscription(deleted);
};
