import {
  PlatformUserAccessScope,
  PlatformUserRole,
  PlatformUserStatus,
  type Prisma
} from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../database/prisma";
import { hashPassword } from "../utils/hash";

const DEFAULT_PLATFORM_PASSWORD = "Admin@123";

export type PlanSeed = {
  name: string;
  price_monthly: string;
  price_annual: string;
  student_limit: number;
  staff_limit: number;
  sms_bundle: number;
  features: Prisma.InputJsonValue;
  sort_order: number;
};

type SmsProviderSeed = {
  name: string;
  slug: string;
  api_key_masked?: string | null;
  sender_id?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  priority?: number;
  config?: Prisma.InputJsonValue | null;
};

export const planSeeds: PlanSeed[] = [
  {
    name: "Basic",
    price_monthly: "3000.00",
    price_annual: "36000.00",
    student_limit: 300,
    staff_limit: 40,
    sms_bundle: 500,
    features: {
      attendance: true,
      gate: true,
      student_management: true,
      notifications: true
    },
    sort_order: 1
  },
  {
    name: "Medium",
    price_monthly: "5000.00",
    price_annual: "60000.00",
    student_limit: 800,
    staff_limit: 120,
    sms_bundle: 2000,
    features: {
      attendance: true,
      gate: true,
      student_management: true,
      notifications: true,
      timetable: true,
      results: true,
      fees: true,
      boarding: true,
      visitor_management: true
    },
    sort_order: 2
  },
  {
    name: "Premium",
    price_monthly: "7000.00",
    price_annual: "84000.00",
    student_limit: 2000,
    staff_limit: 300,
    sms_bundle: 5000,
    features: {
      attendance: true,
      gate: true,
      student_management: true,
      notifications: true,
      timetable: true,
      results: true,
      fees: true,
      boarding: true,
      visitor_management: true,
      payroll: true,
      examinations: true,
      analytics: true,
      priority_support: true
    },
    sort_order: 3
  }
];

const upsertPlan = async (plan: PlanSeed) => {
  const existing = await prisma.subscription_plans.findFirst({
    where: { name: plan.name }
  });

  const data = {
    name: plan.name,
    price_monthly: plan.price_monthly,
    price_annual: plan.price_annual,
    student_limit: plan.student_limit,
    staff_limit: plan.staff_limit,
    sms_bundle: plan.sms_bundle,
    features: plan.features,
    sort_order: plan.sort_order,
    is_active: true
  };

  if (existing) {
    return prisma.subscription_plans.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.subscription_plans.create({ data });
};

const smsProviderSeeds: SmsProviderSeed[] = [
  {
    name: "Rwanda SMS Connect",
    slug: "rwanda-sms-connect",
    api_key_masked: "<REPLACE_WITH_API_KEY>",
    sender_id: "EducCare",
    is_default: false,
    is_active: true,
    priority: 1,
    config: {
      provider: "rwanda",
      api_type: "rwanda",
      base_url: "https://smsconnect.tech/api/v1",
      endpoint: "/sms/send",
      bearer_token: "sms_68OWiI3PHyE7zQjD43VtMxZU",
      api_secret: "YfCC4C5SQeD8Om3y3w1kZ3RATKPEBOeU",
      sender_id: "EducCare"
    }
  },
  {
    name: "Uganda E-Media SMS",
    slug: "uganda-emedia",
    api_key_masked: "<REPLACE_WITH_API_KEY>",
    sender_id: "EducationCare",
    is_default: true,
    is_active: true,
    priority: 2,
    config: {
      provider: "uganda",
      api_type: "uganda",
      base_url: "http://text.emediauganda.com/api.php",
      username: "edcareuganda",
      password: "<REPLACE_WITH_PASSWORD>",
      sender_id: "EducationCare"
    }
  }
];

const upsertSmsProvider = async (provider: SmsProviderSeed) => {
  const data = {
    name: provider.name,
    slug: provider.slug,
    api_key_masked: provider.api_key_masked ?? null,
    sender_id: provider.sender_id ?? null,
    is_default: provider.is_default ?? false,
    is_active: provider.is_active ?? true,
    priority: provider.priority ?? 1,
    config: provider.config ?? undefined
  };

  return prisma.sms_providers.upsert({
    where: { slug: provider.slug },
    update: data,
    create: data
  });
};

export const seedPlans = async () => {
  const plans = [];
  for (const plan of planSeeds) {
    plans.push(await upsertPlan(plan));
  }

  return plans;
};

export const seedPlatform = async () => {
  const plans = await seedPlans();

  const adminEmail = "platform.admin@ecareafrica.test";
  const passwordHash = await hashPassword(DEFAULT_PLATFORM_PASSWORD);

  const platformAdmin = await prisma.platform_users.upsert({
    where: { email: adminEmail },
    update: {
      name: "Platform Admin",
      role: PlatformUserRole.platform_admin,
      access_scope: PlatformUserAccessScope.all,
      status: PlatformUserStatus.active
    },
    create: {
      uuid: uuidv4(),
      name: "Platform Admin",
      email: adminEmail,
      password_hash: passwordHash,
      role: PlatformUserRole.platform_admin,
      access_scope: PlatformUserAccessScope.all,
      status: PlatformUserStatus.active
    }
  });

  const smsProviders = [];
  for (const provider of smsProviderSeeds) {
    smsProviders.push(await upsertSmsProvider(provider));
  }

  return { plans, platformAdmin, smsProviders };
};
