import { z } from "zod";
import { BillingCycle, SchoolSubscriptionStatus } from "@prisma/client";

const decimalSchema = z
  .union([z.number(), z.string()])
  .refine((value) => Number.isFinite(Number(value)), {
    message: "Invalid number"
  });

const dateInput = z.union([z.string(), z.date()]).nullable().optional();

export const subscriptionIdParamSchema = z.object({
  id: z.string().min(1)
});

const createSubscriptionBodySchema = z.object({
  school_id: z.union([z.string(), z.number()]),
  plan_id: z.union([z.string(), z.number()]),
  billing_cycle: z.nativeEnum(BillingCycle).optional(),
  amount: decimalSchema,
  currency: z.string().optional(),
  status: z.nativeEnum(SchoolSubscriptionStatus).optional(),
  starts_at: z.union([z.string(), z.date()]),
  ends_at: dateInput,
  trial_ends_at: dateInput,
  grace_ends_at: dateInput,
  auto_renew: z.boolean().optional(),
  cancelled_at: dateInput,
  cancellation_reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_by: z.union([z.string(), z.number()]).nullable().optional()
});

const updateSubscriptionBodySchema = createSubscriptionBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const listSubscriptionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  status: z.nativeEnum(SchoolSubscriptionStatus).optional(),
  school_id: z.string().optional(),
  plan_id: z.string().optional()
});

export const createSubscriptionSchema = z.object({
  body: createSubscriptionBodySchema
});

export const updateSubscriptionSchema = z.object({
  params: subscriptionIdParamSchema,
  body: updateSubscriptionBodySchema
});

export const listSubscriptionsSchema = z.object({
  query: listSubscriptionsQuerySchema
});
