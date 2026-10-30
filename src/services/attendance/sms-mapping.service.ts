import { Prisma } from "@prisma/client";
import type { attendance_sms_mappings } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

export type AttendanceSmsMappingInput = {
  source_type: string;
  event_type: string;
  scope_key?: string;
  template_id?: string | number | bigint | null;
  send_sms?: boolean;
};

const toBigInt = (value: string | number | bigint) =>
  typeof value === "bigint" ? value : BigInt(value);

const formatMapping = (record: attendance_sms_mappings & {
  template?: { id: bigint; name: string; trigger_type: string; body_en: string } | null;
}) => ({
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  source_type: record.source_type,
  event_type: record.event_type,
  scope_key: record.scope_key,
  template_id: record.template_id?.toString() ?? null,
  send_sms: record.send_sms,
  template: record.template
    ? {
        id: record.template.id.toString(),
        name: record.template.name,
        trigger_type: record.template.trigger_type,
        body_en: record.template.body_en
      }
    : null,
  created_at: record.created_at.toISOString(),
  updated_at: record.updated_at.toISOString()
});

const mappingInclude = {
  template: {
    select: { id: true, name: true, trigger_type: true, body_en: true }
  }
} as const;

const normalizeScopeKey = (value?: string | null) => value?.trim() || "global";

const resolveTemplate = async (
  templateId: string | number | bigint | null | undefined,
  sourceType: string,
  eventType: string
) => {
  if (templateId === null || templateId === undefined) return null;
  const raw = String(templateId);
  if (!/^\d+$/.test(raw)) {
    throw new AppError("bad_request", "Invalid notification template id", 400);
  }

  const template = await prisma.notification_templates.findFirst({
    where: {
      id: toBigInt(raw),
      school_id: null,
      is_active: true
    }
  });

  if (!template) {
    throw new AppError(
      "bad_request",
      `The selected system SMS template is not available for ${sourceType}/${eventType}`,
      400
    );
  }

  return template;
};

export const listMappings = async (schoolId: string | number | bigint) => {
  const records = await prisma.attendance_sms_mappings.findMany({
    where: { school_id: toBigInt(schoolId) },
    include: mappingInclude,
    orderBy: [{ source_type: "asc" }, { event_type: "asc" }, { scope_key: "asc" }]
  });

  return records.map(formatMapping);
};

export const upsertMapping = async (
  schoolId: string | number | bigint,
  input: AttendanceSmsMappingInput
) => {
  const sourceType = input.source_type.trim();
  const eventType = input.event_type.trim();
  const scopeKey = normalizeScopeKey(input.scope_key);

  if (!sourceType || !eventType) {
    throw new AppError("bad_request", "Attendance source and event are required", 400);
  }

  if (input.send_sms !== false && (input.template_id === null || input.template_id === undefined)) {
    throw new AppError("bad_request", "Choose a registered system SMS template or disable SMS", 400);
  }

  const template = await resolveTemplate(input.template_id, sourceType, eventType);
  const school = toBigInt(schoolId);

  const record = await prisma.attendance_sms_mappings.upsert({
    where: {
      school_id_source_type_event_type_scope_key: {
        school_id: school,
        source_type: sourceType,
        event_type: eventType,
        scope_key: scopeKey
      }
    },
    update: {
      template_id: template?.id ?? null,
      send_sms: input.send_sms !== false
    },
    create: {
      school_id: school,
      source_type: sourceType,
      event_type: eventType,
      scope_key: scopeKey,
      template_id: template?.id ?? null,
      send_sms: input.send_sms !== false
    },
    include: mappingInclude
  });

  return formatMapping(record);
};

export const resolveMapping = async (
  schoolId: string | number | bigint,
  sourceType: string | undefined,
  eventType: string,
  scopeKey?: string
) => {
  if (!sourceType) return null;

  const school = toBigInt(schoolId);
  const exactScope = normalizeScopeKey(scopeKey);
  const exact = await prisma.attendance_sms_mappings.findFirst({
    where: {
      school_id: school,
      source_type: sourceType,
      event_type: eventType,
      scope_key: exactScope
    },
    include: mappingInclude
  });

  if (exact) return exact;
  if (exactScope === "global") return null;

  return prisma.attendance_sms_mappings.findFirst({
    where: {
      school_id: school,
      source_type: sourceType,
      event_type: eventType,
      scope_key: "global"
    },
    include: mappingInclude
  });
};
