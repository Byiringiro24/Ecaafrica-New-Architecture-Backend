import { Prisma } from "@prisma/client";
import type { notification_templates } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

const toBigInt = (value: string | number | bigint | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatTemplate = (record: notification_templates) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id ? record.school_id.toString() : null
});

export type TemplateCreateInput = {
  name: string;
  slug: string;
  trigger_type: string;
  body_en: string;
  body_kin?: string | null;
  variables?: Prisma.InputJsonValue | null;
  is_active?: boolean;
};

export type TemplateUpdateInput = Partial<TemplateCreateInput>;

/** Convert legacy escaped/HTML-formatted template text to SMS-safe plain text. */
export const normalizeSmsText = (value: string) => {
  const decoded = value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x20;/gi, " ")
    .replace(/&#x0a;/gi, "\n")
    .replace(/&#10;/gi, "\n")
    .replace(/&#x0d;/gi, "\n")
    .replace(/&#13;/gi, "\n")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return decoded
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const renderTemplate = (
  body: string,
  variables: Record<string, string | number | boolean> = {}
) =>
  normalizeSmsText(
    body.replace(/\{\{\s*([\w.]+)\s*\}\}|\$\{\s*([\w.]+)\s*\}/g, (_, keyA: string, keyB: string) => {
      const key = keyA ?? keyB;
      const value = variables[key];
      return value !== undefined && value !== null ? String(value) : "";
    })
  );

export const createTemplate = async (
  schoolId: string | number | bigint | null | undefined,
  input: TemplateCreateInput
) => {
  try {
    const record = await prisma.notification_templates.create({
      data: {
        school_id: toBigInt(schoolId),
        name: input.name,
        slug: input.slug,
        trigger_type: input.trigger_type,
        body_en: normalizeSmsText(input.body_en),
        body_kin: input.body_kin ? normalizeSmsText(input.body_kin) : null,
        variables: input.variables ?? undefined,
        is_active: input.is_active ?? true
      }
    });

    return formatTemplate(record);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("conflict", "Template slug already exists for this school", 409);
    }

    throw error;
  }
};

export const findAllTemplates = async (
  schoolId: string | number | bigint | null | undefined,
  pagination: PaginationParams,
  filters: { is_active?: boolean; trigger_type?: string } = {}
) => {
  const { page, limit, q } = pagination;
  const school = toBigInt(schoolId);
  const visibilityWhere: Prisma.notification_templatesWhereInput = school === null
    ? { school_id: null }
    : { OR: [{ school_id: school }, { school_id: null }] };
  const where: Prisma.notification_templatesWhereInput = { ...visibilityWhere };

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  if (filters.trigger_type) {
    where.trigger_type = filters.trigger_type;
  }

  if (q) {
    where.AND = [
      visibilityWhere,
      {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } }
        ]
      }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.notification_templates.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification_templates.count({ where })
  ]);

  return {
    data: items.map(formatTemplate),
    meta: { page, limit, total }
  };
};

export const findTemplateById = async (
  schoolId: string | number | bigint | null | undefined,
  id: string
) => {
  const templateId = toBigInt(id);
  const baseWhere: Prisma.notification_templatesWhereInput = {
    id: templateId ?? undefined
  };

  const record = await prisma.notification_templates.findFirst({
    where:
      schoolId === null || schoolId === undefined
        ? { ...baseWhere, school_id: null }
        : {
            ...baseWhere,
            OR: [{ school_id: toBigInt(schoolId) }, { school_id: null }]
          }
  });

  if (!record) {
    throw new AppError("not_found", "Notification template not found", 404);
  }

  return formatTemplate(record);
};

export const updateTemplate = async (
  schoolId: string | number | bigint | null | undefined,
  id: string,
  input: TemplateUpdateInput
) => {
  const templateId = toBigInt(id);
  const existing = await prisma.notification_templates.findFirst({
    where:
      schoolId === null || schoolId === undefined
        ? { id: templateId ?? undefined, school_id: null }
        : {
            id: templateId ?? undefined,
            OR: [{ school_id: toBigInt(schoolId) }, { school_id: null }]
          }
  });

  if (!existing) {
    throw new AppError("not_found", "Notification template not found", 404);
  }

  try {
    const record = await prisma.notification_templates.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? undefined,
        slug: input.slug ?? undefined,
        trigger_type: input.trigger_type ?? undefined,
        body_en: input.body_en === undefined ? undefined : normalizeSmsText(input.body_en),
        body_kin:
          input.body_kin === undefined
            ? undefined
            : input.body_kin
              ? normalizeSmsText(input.body_kin)
              : null,
        variables:
          input.variables === undefined
            ? undefined
            : input.variables === null
              ? Prisma.DbNull
              : input.variables,
        is_active: input.is_active ?? undefined
      }
    });

    return formatTemplate(record);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("conflict", "Template slug already exists for this school", 409);
    }

    throw error;
  }
};

export const deleteTemplate = async (
  schoolId: string | number | bigint | null | undefined,
  id: string
) => {
  const templateId = toBigInt(id);
  const existing = await prisma.notification_templates.findFirst({
    where:
      schoolId === null || schoolId === undefined
        ? { id: templateId ?? undefined, school_id: null }
        : {
            id: templateId ?? undefined,
            OR: [{ school_id: toBigInt(schoolId) }, { school_id: null }]
          }
  });

  if (!existing) {
    throw new AppError("not_found", "Notification template not found", 404);
  }

  await prisma.notification_templates.delete({ where: { id: existing.id } });
  return formatTemplate(existing);
};

export const renderTemplateById = async (
  schoolId: string | number | bigint | null | undefined,
  id: string,
  variables: Record<string, string | number | boolean> = {},
  language: "en" | "kin" = "en"
) => {
  const template = await findTemplateById(schoolId, id);
  const body =
    language === "kin" && template.body_kin ? template.body_kin : template.body_en;

  return {
    template_id: template.id,
    language,
    rendered: renderTemplate(body, variables)
  };
};
