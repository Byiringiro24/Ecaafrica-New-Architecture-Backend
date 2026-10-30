import { NotificationRecipientType } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { logger } from "../../utils/logger";
import { sendSMS } from "../notification/sender.service";
import { normalizeSmsText, renderTemplate } from "../notification/template.service";
import { resolveMapping } from "./sms-mapping.service";

export type AttendanceNotificationKind =
  | "school_entry"
  | "school_exit"
  | "class_entry"
  | "class_late"
  | "class_absent"
  | "class_excused"
  | "dormitory_morning_present"
  | "dormitory_morning_absent"
  | "dormitory_morning_on_leave"
  | "dormitory_evening_present"
  | "dormitory_evening_absent"
  | "dormitory_evening_on_leave"
  | "device_late"
  | "device_absent";

const DEFAULT_ATTENDANCE_TEMPLATES: Record<
  AttendanceNotificationKind,
  { name: string; slug: string; body: string }
> = {
  school_entry: {
    name: "Attendance school entry SMS",
    slug: "attendance-school-entry-sms",
    body: "Education Care\nAttendance: Your child, ${student_name}, has arrived safely at school.\nDate: ${date}\nTime: ${time}"
  },
  school_exit: {
    name: "Attendance school exit SMS",
    slug: "attendance-school-exit-sms",
    body: "Education Care\nAttendance: Your child, ${student_name}, has left school safely.\nDate: ${date}\nTime: ${time}"
  },
  class_entry: {
    name: "Attendance class present SMS",
    slug: "attendance-class-entry-sms",
    body: "Education Care\nAttendance: ${student_name} is present in class.\nDate: ${date}\nTime: ${time}"
  },
  class_late: {
    name: "Attendance class late SMS",
    slug: "attendance-class-late-sms",
    body: "Education Care\nAttendance: ${student_name} arrived late to class.\nDate: ${date}\nTime: ${time}"
  },
  class_absent: {
    name: "Attendance class absent SMS",
    slug: "attendance-class-absent-sms",
    body: "Education Care\nAttendance alert: ${student_name} was absent from class.\nDate: ${date}\nTime: ${time}\nPlease follow up with the school."
  },
  class_excused: {
    name: "Attendance class excused SMS",
    slug: "attendance-class-excused-sms",
    body: "Education Care\nAttendance: ${student_name} was excused from class.\nDate: ${date}\nTime: ${time}"
  },
  dormitory_morning_present: {
    name: "Dormitory morning present SMS",
    slug: "attendance-dormitory-morning-present-sms",
    body: "Education Care\nBoarding attendance: ${student_name} was present during the morning dormitory roll call.\nDate: ${date}\nTime: ${time}"
  },
  dormitory_morning_absent: {
    name: "Dormitory morning absent SMS",
    slug: "attendance-dormitory-morning-absent-sms",
    body: "Education Care\nBoarding attendance alert: ${student_name} was absent from the morning dormitory roll call.\nDate: ${date}\nTime: ${time}"
  },
  dormitory_morning_on_leave: {
    name: "Dormitory morning on leave SMS",
    slug: "attendance-dormitory-morning-on-leave-sms",
    body: "Education Care\nBoarding attendance: ${student_name} was recorded on leave during the morning roll call.\nDate: ${date}\nTime: ${time}"
  },
  dormitory_evening_present: {
    name: "Dormitory evening present SMS",
    slug: "attendance-dormitory-evening-present-sms",
    body: "Education Care\nBoarding attendance: ${student_name} was present during the evening dormitory roll call.\nDate: ${date}\nTime: ${time}"
  },
  dormitory_evening_absent: {
    name: "Dormitory evening absent SMS",
    slug: "attendance-dormitory-evening-absent-sms",
    body: "Education Care\nBoarding attendance alert: ${student_name} was absent from the evening dormitory roll call.\nDate: ${date}\nTime: ${time}"
  },
  dormitory_evening_on_leave: {
    name: "Dormitory evening on leave SMS",
    slug: "attendance-dormitory-evening-on-leave-sms",
    body: "Education Care\nBoarding attendance: ${student_name} was recorded on leave during the evening roll call.\nDate: ${date}\nTime: ${time}"
  },
  device_late: {
    name: "Attendance device late SMS",
    slug: "attendance-device-late-sms",
    body: "Education Care\nAttendance alert: ${student_name} was recorded late.\nDate: ${date}\nTime: ${time}"
  },
  device_absent: {
    name: "Attendance device absent SMS",
    slug: "attendance-device-absent-sms",
    body: "Education Care\nAttendance alert: ${student_name} was not recorded during the configured attendance window.\nDate: ${date}\nTime: ${time}"
  }
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatTime = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatDate = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

const formatStudentName = (firstName?: string | null, lastName?: string | null) =>
  [firstName, lastName].filter(Boolean).join(" ").trim() || "your child";

const appendDateTimeFooter = (body: string, time: string, date: string) => {
  const cleanBody = normalizeSmsText(body)
    .split("\n")
    .filter((line) => !/^\s*(Date|Time)\s*:/i.test(line))
    .join("\n")
    .trim();

  return normalizeSmsText(`${cleanBody}\nDate: ${date}\nTime: ${time}`);
};

const resolveAttendanceTemplate = async (
  schoolId: string | number | bigint,
  kind: AttendanceNotificationKind
) => {
  const existing = await prisma.notification_templates.findFirst({
    where: {
      school_id: null,
      trigger_type: kind,
      is_active: true
    },
    orderBy: { created_at: "desc" }
  });

  if (existing) {
    return existing;
  }

  const defaults = DEFAULT_ATTENDANCE_TEMPLATES[kind];
  if (!defaults) {
    return null;
  }

  try {
    return await prisma.notification_templates.create({
      data: {
        school_id: null,
        name: defaults.name,
        slug: defaults.slug,
        trigger_type: kind,
        body_en: defaults.body,
        variables: { student_name: "", time: "", date: "" },
        is_active: true
      }
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return prisma.notification_templates.findFirst({
        where: {
          school_id: null,
          trigger_type: kind,
          is_active: true
        },
        orderBy: { created_at: "desc" }
      });
    }

    throw error;
  }
};

const resolveOverrideTemplate = async (
  schoolId: string | number | bigint,
  templateIdOverride: string | number | bigint
) => {
  try {
    return await prisma.notification_templates.findFirst({
      where: {
        id: toBigInt(templateIdOverride),
        OR: [{ school_id: toBigInt(schoolId) }, { school_id: null }],
        is_active: true
      }
    });
  } catch (error) {
    logger.warn(
      { err: error, templateId: String(templateIdOverride) },
      "Could not resolve session-specific notification template, falling back to default"
    );

    return null;
  }
};

const buildMessage = async (
  schoolId: string | number | bigint,
  kind: AttendanceNotificationKind,
  studentName: string,
  time: string,
  date: string,
  templateIdOverride?: string | number | bigint,
  sourceType?: string,
  scopeKey?: string,
  context: Record<string, string | number | boolean> = {}
) => {
  const mapping = await resolveMapping(schoolId, sourceType, kind, scopeKey);
  if (sourceType && !mapping) {
    return { message: null, templateId: null, disabled: true };
  }

  if (mapping && !mapping.send_sms) {
    return { message: null, templateId: null, disabled: true };
  }

  const mappedTemplateId = mapping?.template_id ?? undefined;
  const selectedTemplateId = mapping
    ? mappedTemplateId
    : templateIdOverride;
  const overrideTemplate = selectedTemplateId
    ? await resolveOverrideTemplate(schoolId, selectedTemplateId)
    : null;
  const template = overrideTemplate ?? (await resolveAttendanceTemplate(schoolId, kind));
  const fallbackBody = DEFAULT_ATTENDANCE_TEMPLATES[kind].body;
  const body = template?.body_en?.trim() ? template.body_en : fallbackBody;

  const renderedMessage = renderTemplate(body, {
    student_name: studentName,
    studentName,
    time,
    date,
    attendance_type: kind,
    attendanceType: kind,
    ...context
  });

  return {
    message: appendDateTimeFooter(renderedMessage, time, date),
    templateId: template?.id ?? null,
    disabled: false
  };
};

const resolvePrimaryParent = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const link = await prisma.student_parent_links.findFirst({
    where: {
      student_id: toBigInt(studentId),
      student: { school_id: toBigInt(schoolId), deleted_at: null }
    },
    orderBy: [{ is_primary: "desc" }, { id: "asc" }],
    select: {
      parent: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone: true
        }
      }
    }
  });

  return link?.parent ?? null;
};

export const sendAttendanceNotification = async (input: {
  schoolId: string | number | bigint;
  studentId: string | number | bigint;
  kind: AttendanceNotificationKind;
  occurredAt: Date | string;
  templateId?: string | number | bigint;
  sourceType?: string;
  scopeKey?: string;
  context?: Record<string, string | number | boolean>;
}) => {
  const school = await prisma.schools.findFirst({
    where: {
      id: toBigInt(input.schoolId),
      deleted_at: null
    },
    select: {
      id: true
    }
  });

  if (!school) {
    return null;
  }

  const student = await prisma.students.findFirst({
    where: {
      id: toBigInt(input.studentId),
      school_id: toBigInt(input.schoolId),
      deleted_at: null
    },
    select: {
      first_name: true,
      last_name: true
    }
  });

  if (!student) {
    return null;
  }

  const parent = await resolvePrimaryParent(input.schoolId, input.studentId);

  if (!parent?.phone) {
    return null;
  }

  const studentName = formatStudentName(student.first_name, student.last_name);
  const { message, templateId } = await buildMessage(
    input.schoolId,
    input.kind,
    studentName,
    formatTime(input.occurredAt),
    formatDate(input.occurredAt),
    input.templateId,
    input.sourceType,
    input.scopeKey,
    input.context
  );

  if (!message) {
    return null;
  }

  try {
    return await sendSMS(parent.phone, message, undefined, input.schoolId, {
      recipientType: NotificationRecipientType.parent,
      recipientId: parent.id,
      triggerType: input.kind,
      templateId: templateId ?? undefined
    });
  } catch (error) {
    logger.warn(
      {
        err: error,
        schoolId: String(input.schoolId),
        studentId: String(input.studentId),
        kind: input.kind
      },
      "Attendance SMS could not be sent"
    );

    return null;
  }
};
