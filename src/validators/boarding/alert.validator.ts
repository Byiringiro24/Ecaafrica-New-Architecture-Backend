import { AbsenceAlertType, AlertSeverity, AlertStatus } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);

export const absenceAlertIdParamSchema = z.object({
  id: z.string().min(1)
});

const createAbsenceAlertBodySchema = z.object({
  student_id: idInput,
  alert_type: z.nativeEnum(AbsenceAlertType),
  severity: z.nativeEnum(AlertSeverity).optional(),
  description: z.string().optional()
});

const updateAbsenceAlertBodySchema = z
  .object({
    alert_type: z.nativeEnum(AbsenceAlertType).optional(),
    severity: z.nativeEnum(AlertSeverity).optional(),
    description: z.string().nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listAbsenceAlertsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  student_id: z.string().optional(),
  status: z.nativeEnum(AlertStatus).optional(),
  alert_type: z.nativeEnum(AbsenceAlertType).optional(),
  severity: z.nativeEnum(AlertSeverity).optional()
});

const resolveAbsenceAlertBodySchema = z.object({
  resolution_note: z.string().optional()
});

export const createAbsenceAlertSchema = z.object({
  body: createAbsenceAlertBodySchema
});

export const updateAbsenceAlertSchema = z.object({
  params: absenceAlertIdParamSchema,
  body: updateAbsenceAlertBodySchema
});

export const listAbsenceAlertsSchema = z.object({
  query: listAbsenceAlertsQuerySchema
});

export const resolveAbsenceAlertSchema = z.object({
  params: absenceAlertIdParamSchema,
  body: resolveAbsenceAlertBodySchema
});
