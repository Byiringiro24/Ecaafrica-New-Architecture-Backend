import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import type {
  InvoiceStatus,
  SchoolStatus,
  SchoolType,
  schools,
  subscription_plans
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import { issuePasswordResetToken } from "../auth.service";
import { buildResetUrl, sendSchoolSuspensionEmail, sendSchoolWelcomeEmail } from "../../utils/mailer";

type SchoolFilters = {
  status?: string;
  exclude_status?: string;
  province?: string;
  district?: string;
  country?: string;
  school_type?: string;
  subscription_plan_id?: string | number | bigint;
  has_boarding?: boolean;
  has_biometrics?: boolean;
  has_gate?: boolean;
  has_visitor_mgmt?: boolean;
  has_exam_system?: boolean;
  has_salary_mgmt?: boolean;
  has_parent_app?: boolean;
  has_bulk_sms?: boolean;
  include_deleted?: boolean;
};

type SchoolCreateInput = {
  name: string;
  school_type?: string;
  province: string;
  district: string;
  country?: string | null;
  sector?: string | null;
  logo_url?: string | null;
  website?: string | null;
  principal_name?: string | null;
  principal_phone?: string | null;
  principal_email?: string | null;
  school_phone?: string | null;
  school_email?: string | null;
  subscription_plan_id?: string | number | bigint | null;
  status?: string;
  trial_ends_at?: string | Date | null;
  grace_ends_at?: string | Date | null;
  timezone?: string;
  currency?: string;
  has_boarding?: boolean;
  has_biometrics?: boolean;
  has_gate?: boolean;
  has_visitor_mgmt?: boolean;
  has_exam_system?: boolean;
  has_salary_mgmt?: boolean;
  has_parent_app?: boolean;
  has_bulk_sms?: boolean;
  settings?: Prisma.InputJsonValue | null;
  subscription_billing_cycle?: "monthly" | "annual";
};

type SchoolUpdateInput = Partial<SchoolCreateInput>;

type SchoolRecord = schools & {
  subscription_plan?: subscription_plans | null;
  _count?: { students: number; users: number };
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

const formatPlan = (plan: subscription_plans) => ({
  ...plan,
  id: plan.id.toString()
});

const formatSchool = (school: SchoolRecord) => ({
  ...school,
  id: school.id.toString(),
  subscription_plan_id: school.subscription_plan_id
    ? school.subscription_plan_id.toString()
    : null,
  subscription_plan: school.subscription_plan
    ? formatPlan(school.subscription_plan)
    : null,
  student_count: school._count?.students ?? 0,
  staff_count: school._count?.users ?? 0
});

const SCHOOL_SUSPENSION_MESSAGE =
  "School suspended. Check your email and contact the system administrator.";

const resolveSchoolNotificationRecipients = (school: {
  school_email?: string | null;
  principal_email?: string | null;
}) => Array.from(
  new Set(
    [school.school_email, school.principal_email].filter(
      (email): email is string => Boolean(email)
    )
  )
);

const notifySchoolSuspension = async (school: {
  name: string;
  school_email?: string | null;
  principal_email?: string | null;
}) => {
  const recipients = resolveSchoolNotificationRecipients(school);

  if (!recipients.length) {
    logger.warn({ schoolName: school.name }, "Suspended school has no notification email");
    return;
  }

  for (const recipient of recipients) {
    try {
      await sendSchoolSuspensionEmail(recipient, school.name);
    } catch (error) {
      logger.error(
        { err: error, schoolName: school.name, recipient },
        "Failed to notify school about suspension"
      );
    }
  }
};

const resolveSchoolWhere = (id: string) => {
  if (/^\d+$/.test(id)) {
    return { id: toBigInt(id) };
  }

  return { uuid: id };
};

const resolveSchoolRecord = async (id: string) => {
  const school = await prisma.schools.findFirst({
    where: {
      ...resolveSchoolWhere(id),
      deleted_at: null
    },
    select: { id: true }
  });

  if (!school) {
    throw new AppError("not_found", "School not found", 404);
  }

  return school;
};

const resolveSchoolNotificationRecord = async (id: string) => {
  const school = await prisma.schools.findFirst({
    where: {
      ...resolveSchoolWhere(id),
      deleted_at: null
    },
    select: {
      id: true,
      name: true,
      status: true,
      school_email: true,
      principal_email: true
    }
  });

  if (!school) {
    throw new AppError("not_found", "School not found", 404);
  }

  return school;
};

const buildSchoolUpdateData = (input: SchoolUpdateInput): Prisma.schoolsUpdateInput => {
  const data: Prisma.schoolsUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.school_type !== undefined) data.school_type = input.school_type as SchoolType;
  if (input.province !== undefined) data.province = input.province;
  if (input.district !== undefined) data.district = input.district;
  if (input.country !== undefined) data.country = input.country;
  if (input.sector !== undefined) data.sector = input.sector;
  if (input.logo_url !== undefined) data.logo_url = input.logo_url;
  if (input.website !== undefined) data.website = input.website;
  if (input.principal_name !== undefined) data.principal_name = input.principal_name;
  if (input.principal_phone !== undefined) data.principal_phone = input.principal_phone;
  if (input.principal_email !== undefined) data.principal_email = input.principal_email;
  if (input.school_phone !== undefined) data.school_phone = input.school_phone;
  if (input.school_email !== undefined) data.school_email = input.school_email;
  if (input.subscription_plan_id !== undefined) {
    data.subscription_plan =
      input.subscription_plan_id === null
        ? { disconnect: true }
        : { connect: { id: toBigInt(input.subscription_plan_id) } };
  }
  if (input.status !== undefined) data.status = input.status as SchoolStatus;
  if (input.trial_ends_at !== undefined) data.trial_ends_at = toDateValue(input.trial_ends_at);
  if (input.grace_ends_at !== undefined) data.grace_ends_at = toDateValue(input.grace_ends_at);
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.has_boarding !== undefined) data.has_boarding = input.has_boarding;
  if (input.has_biometrics !== undefined) data.has_biometrics = input.has_biometrics;
  if (input.has_gate !== undefined) data.has_gate = input.has_gate;
  if (input.has_visitor_mgmt !== undefined) data.has_visitor_mgmt = input.has_visitor_mgmt;
  if (input.has_exam_system !== undefined) data.has_exam_system = input.has_exam_system;
  if (input.has_salary_mgmt !== undefined) data.has_salary_mgmt = input.has_salary_mgmt;
  if (input.has_parent_app !== undefined) data.has_parent_app = input.has_parent_app;
  if (input.has_bulk_sms !== undefined) data.has_bulk_sms = input.has_bulk_sms;
  if (input.settings !== undefined) {
    data.settings = input.settings === null ? Prisma.DbNull : input.settings;
  }

  return data;
};

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "name", "status"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.schoolsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.schoolsOrderByWithRelationInput;
};

const formatBillingSubscription = (subscription: {
  id: bigint;
  school_id: bigint;
  plan_id: bigint;
  billing_cycle: unknown;
  amount: Prisma.Decimal;
  currency: string;
  status: unknown;
  starts_at: Date;
  ends_at: Date | null;
  trial_ends_at: Date | null;
  grace_ends_at: Date | null;
  auto_renew: boolean;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_by: bigint | null;
  created_at: Date;
  updated_at: Date;
  plan?: subscription_plans | null;
}) => ({
  ...subscription,
  id: subscription.id.toString(),
  school_id: subscription.school_id.toString(),
  plan_id: subscription.plan_id.toString(),
  created_by: subscription.created_by ? subscription.created_by.toString() : null,
  plan: subscription.plan ? formatPlan(subscription.plan) : null
});

const formatBillingInvoice = (invoice: {
  id: bigint;
  invoice_number: string;
  school_id: bigint;
  subscription_id: bigint | null;
  period_start: Date;
  period_end: Date;
  issue_date: Date;
  due_date: Date;
  subtotal: Prisma.Decimal;
  tax_rate: Prisma.Decimal;
  tax_amount: Prisma.Decimal;
  discount_amount: Prisma.Decimal;
  total: Prisma.Decimal;
  currency: string;
  status: unknown;
  paid_at: Date | null;
  payment_method: string | null;
  payment_ref: string | null;
  notes: string | null;
  pdf_url: string | null;
  created_by: bigint | null;
  created_at: Date;
  updated_at: Date;
}) => ({
  ...invoice,
  id: invoice.id.toString(),
  school_id: invoice.school_id.toString(),
  subscription_id: invoice.subscription_id ? invoice.subscription_id.toString() : null,
  created_by: invoice.created_by ? invoice.created_by.toString() : null
});

export const createSchool = async (input: SchoolCreateInput) => {
  const created = await prisma.$transaction(async (tx) => {
    const school = await tx.schools.create({
      data: {
      uuid: uuidv4(),
      name: input.name,
      school_type: (input.school_type as SchoolType) ?? undefined,
      province: input.province,
      district: input.district,
      country: input.country ?? null,
      sector: input.sector ?? null,
      logo_url: input.logo_url ?? null,
      website: input.website ?? null,
      principal_name: input.principal_name ?? null,
      principal_phone: input.principal_phone ?? null,
      principal_email: input.principal_email ?? null,
      school_phone: input.school_phone ?? null,
      school_email: input.school_email ?? null,
      subscription_plan_id:
        input.subscription_plan_id !== undefined && input.subscription_plan_id !== null
          ? toBigInt(input.subscription_plan_id)
          : undefined,
      status: (input.status as SchoolStatus) ?? undefined,
      trial_ends_at: toDateValue(input.trial_ends_at) ?? undefined,
      grace_ends_at: toDateValue(input.grace_ends_at) ?? undefined,
      timezone: input.timezone ?? undefined,
      currency: input.currency ?? undefined,
      has_boarding: input.has_boarding ?? undefined,
      has_biometrics: input.has_biometrics ?? undefined,
      has_gate: input.has_gate ?? undefined,
      has_visitor_mgmt: input.has_visitor_mgmt ?? undefined,
      has_exam_system: input.has_exam_system ?? undefined,
      has_salary_mgmt: input.has_salary_mgmt ?? undefined,
      has_parent_app: input.has_parent_app ?? undefined,
      has_bulk_sms: input.has_bulk_sms ?? undefined,
      settings: input.settings ?? undefined
      },
      include: {
        subscription_plan: true,
        _count: { select: { students: true, users: true } }
      }
    });

    if (input.subscription_plan_id !== undefined && input.subscription_plan_id !== null && school.subscription_plan) {
      const cycle = input.subscription_billing_cycle === "annual" ? "annual" : "monthly";
      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      if (cycle === "annual") endsAt.setFullYear(endsAt.getFullYear() + 1);
      else endsAt.setMonth(endsAt.getMonth() + 1);

      await tx.school_subscriptions.create({
        data: {
          school_id: school.id,
          plan_id: school.subscription_plan.id,
          billing_cycle: cycle,
          amount: cycle === "annual" ? school.subscription_plan.price_annual : school.subscription_plan.price_monthly,
          currency: input.currency ?? "RWF",
          status: school.status === "trial" ? "trial" : "active",
          starts_at: startsAt,
          ends_at: endsAt,
          trial_ends_at: school.trial_ends_at,
          grace_ends_at: school.grace_ends_at,
          auto_renew: true
        }
      });
    }

    return school;
  });

  const welcomeEmail = input.school_email ?? input.principal_email ?? null;
  if (welcomeEmail) {
    try {
      const resetResult = await issuePasswordResetToken(welcomeEmail);
      const resetUrl = resetResult ? buildResetUrl(resetResult.token) : undefined;
      await sendSchoolWelcomeEmail(welcomeEmail, created.name, resetUrl);
    } catch (error) {
      logger.error({ err: error, email: welcomeEmail }, "Welcome email failed");
    }
  }

  return formatSchool(created);
};

export const findAllSchools = async (
  pagination: PaginationParams,
  filters: SchoolFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.schoolsWhereInput = {
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.status) where.status = filters.status as SchoolStatus;
  if (filters.exclude_status) where.status = { not: filters.exclude_status as SchoolStatus };
  if (filters.country) where.country = { equals: filters.country };
  if (filters.province) where.province = { equals: filters.province };
  if (filters.district) where.district = { equals: filters.district };
  if (filters.school_type) where.school_type = filters.school_type as SchoolType;
  if (filters.subscription_plan_id) {
    where.subscription_plan_id = toBigInt(filters.subscription_plan_id);
  }
  if (filters.has_boarding !== undefined) where.has_boarding = filters.has_boarding;
  if (filters.has_biometrics !== undefined) where.has_biometrics = filters.has_biometrics;
  if (filters.has_gate !== undefined) where.has_gate = filters.has_gate;
  if (filters.has_visitor_mgmt !== undefined) where.has_visitor_mgmt = filters.has_visitor_mgmt;
  if (filters.has_exam_system !== undefined) where.has_exam_system = filters.has_exam_system;
  if (filters.has_salary_mgmt !== undefined) where.has_salary_mgmt = filters.has_salary_mgmt;
  if (filters.has_parent_app !== undefined) where.has_parent_app = filters.has_parent_app;
  if (filters.has_bulk_sms !== undefined) where.has_bulk_sms = filters.has_bulk_sms;

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { province: { contains: q, mode: "insensitive" } },
      { district: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.schools.findMany({
      where,
      include: { subscription_plan: true, _count: { select: { students: true, users: true } } },
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.schools.count({ where })
  ]);

  return {
    data: items.map((item) => formatSchool(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findSchoolById = async (id: string) => {
  const school = await prisma.schools.findFirst({
    where: {
      ...resolveSchoolWhere(id),
      deleted_at: null
    },
    include: { subscription_plan: true, _count: { select: { students: true, users: true } } }
  });

  if (!school) {
    throw new AppError("not_found", "School not found", 404);
  }

  return formatSchool(school);
};

export const getSchoolOverview = async (id: string) => {
  const school = await resolveSchoolRecord(id);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [studentCount, staffCount, classCount, smsCount] = await prisma.$transaction([
    prisma.students.count({
      where: { school_id: school.id }
    }),
    prisma.users.count({
      where: { school_id: school.id, deleted_at: null }
    }),
    prisma.classes.count({
      where: { school_id: school.id, deleted_at: null }
    }),
    prisma.notification_logs.count({
      where: {
        school_id: school.id,
        channel: "sms",
        created_at: { gte: monthStart, lt: nextMonth }
      }
    })
  ]);

  return {
    school_id: school.id.toString(),
    student_count: studentCount,
    staff_count: staffCount,
    class_count: classCount,
    sms_sent_month: smsCount
  };
};

export const getSchoolBilling = async (
  id: string,
  pagination: PaginationParams,
  filters: { status?: string } = {}
) => {
  const school = await resolveSchoolRecord(id);
  const { page, limit, sort, order } = pagination;
  const orderBy: Prisma.invoicesOrderByWithRelationInput =
    sort === "issue_date" || sort === "due_date" || sort === "status"
      ? { [sort]: order ?? "desc" }
      : { issue_date: "desc" };
  const where: Prisma.invoicesWhereInput = { school_id: school.id };

  if (filters.status) {
    where.status = filters.status as InvoiceStatus;
  }

  const [subscription, invoices, total] = await prisma.$transaction([
    prisma.school_subscriptions.findFirst({
      where: { school_id: school.id },
      include: { plan: true },
      orderBy: { starts_at: "desc" }
    }),
    prisma.invoices.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.invoices.count({ where })
  ]);

  return {
    subscription: subscription ? formatBillingSubscription(subscription) : null,
    invoices: invoices.map(formatBillingInvoice),
    meta: { page, limit, total }
  };
};

export const updateSchool = async (id: string, input: SchoolUpdateInput) => {
  const existing = await resolveSchoolNotificationRecord(id);
  const nextStatus = input.status as SchoolStatus | undefined;
  const isSuspending = nextStatus === "suspended" && existing.status !== "suspended";

  const updated = await prisma.schools.update({
    where: { id: existing.id },
    data: buildSchoolUpdateData(input),
    include: { subscription_plan: true, _count: { select: { students: true, users: true } } }
  });

  if (isSuspending) {
    await prisma.sessions.updateMany({
      where: {
        school_id: existing.id,
        revoked_at: null
      },
      data: { revoked_at: new Date() }
    });

    await notifySchoolSuspension(updated);
  }

  return formatSchool(updated);
};

export const updateSchoolStatus = async (id: string, status: string) => {
  const existing = await resolveSchoolNotificationRecord(id);
  const isSuspending = status === "suspended" && existing.status !== "suspended";

  const updated = await prisma.schools.update({
    where: { id: existing.id },
    data: { status: status as SchoolStatus },
    include: { subscription_plan: true, _count: { select: { students: true, users: true } } }
  });

  if (isSuspending) {
    await prisma.sessions.updateMany({
      where: {
        school_id: existing.id,
        revoked_at: null
      },
      data: { revoked_at: new Date() }
    });

    await notifySchoolSuspension(updated);
  }

  return formatSchool(updated);
};

export const softDeleteSchool = async (id: string) => {
  const existing = await prisma.schools.findFirst({
    where: {
      ...resolveSchoolWhere(id),
      deleted_at: null
    }
  });

  if (!existing) {
    throw new AppError("not_found", "School not found", 404);
  }

  const deleted = await prisma.schools.update({
    where: { id: existing.id },
    data: { deleted_at: new Date() },
    include: { subscription_plan: true }
  });

  return formatSchool(deleted);
};
