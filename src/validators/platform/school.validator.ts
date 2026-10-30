import { z } from "zod";
import { InvoiceStatus, SchoolStatus, SchoolType, UserRole, UserStatus } from "@prisma/client";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const dateInput = z.union([z.string(), z.date()]).nullable().optional();

export const schoolIdParamSchema = z.object({
  id: z.string().min(1)
});

const createSchoolBodySchema = z.object({
  name: z.string().min(2),
  school_type: z.nativeEnum(SchoolType).optional(),
  country: z.string().min(2),
  province: z.string().min(2),
  district: z.string().min(2),
  sector: z.string().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  website: z.string().url().nullable().optional(),
  principal_name: z.string().nullable().optional(),
  principal_phone: z.string().nullable().optional(),
  principal_email: z.string().email().nullable().optional(),
  school_phone: z.string().nullable().optional(),
  school_email: z.string().email().nullable().optional(),
  subscription_plan_id: z.union([z.string(), z.number()]).nullable().optional(),
  subscription_billing_cycle: z.enum(["monthly", "annual"]).optional(),
  status: z.nativeEnum(SchoolStatus).optional(),
  trial_ends_at: dateInput,
  grace_ends_at: dateInput,
  timezone: z.string().optional(),
  currency: z.string().optional(),
  has_boarding: z.boolean().optional(),
  has_biometrics: z.boolean().optional(),
  has_gate: z.boolean().optional(),
  has_visitor_mgmt: z.boolean().optional(),
  has_exam_system: z.boolean().optional(),
  has_salary_mgmt: z.boolean().optional(),
  has_parent_app: z.boolean().optional(),
  has_bulk_sms: z.boolean().optional(),
  settings: z.unknown().nullable().optional()
});

const updateSchoolBodySchema = createSchoolBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const listSchoolsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  status: z.nativeEnum(SchoolStatus).optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  country: z.string().optional(),
  school_type: z.nativeEnum(SchoolType).optional(),
  subscription_plan_id: z.string().optional(),
  exclude_status: z.nativeEnum(SchoolStatus).optional(),
  has_boarding: booleanQuery,
  has_biometrics: booleanQuery,
  has_gate: booleanQuery,
  has_visitor_mgmt: booleanQuery,
  has_exam_system: booleanQuery,
  has_salary_mgmt: booleanQuery,
  has_parent_app: booleanQuery,
  has_bulk_sms: booleanQuery,
  include_deleted: booleanQuery
});

export const createSchoolSchema = z.object({
  body: createSchoolBodySchema
});

export const updateSchoolSchema = z.object({
  params: schoolIdParamSchema,
  body: updateSchoolBodySchema
});

export const listSchoolsSchema = z.object({
  query: listSchoolsQuerySchema
});

const listSchoolUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  include_deleted: booleanQuery
});

const listSchoolAuditLogsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  actor_id: z.string().optional(),
  actor_type: z.enum(["platform_user", "school_user", "system", "api"]).optional(),
  action: z.string().optional(),
  resource_type: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  from: z.string().optional(),
  to: z.string().optional()
});

const listSchoolBillingQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  status: z.nativeEnum(InvoiceStatus).optional()
});

export const listSchoolUsersSchema = z.object({
  params: schoolIdParamSchema,
  query: listSchoolUsersQuerySchema
});

export const listSchoolAuditLogsSchema = z.object({
  params: schoolIdParamSchema,
  query: listSchoolAuditLogsQuerySchema
});

export const listSchoolBillingSchema = z.object({
  params: schoolIdParamSchema,
  query: listSchoolBillingQuerySchema
});
