import { GateEventType, ScanMethod } from "@prisma/client";
import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const idInput = z.union([z.string(), z.number()]);

export const gateLogIdParamSchema = z.object({
  id: z.string().min(1)
});

const createGateLogBodySchema = z.object({
  student_id: idInput.optional(),
  event_type: z.nativeEnum(GateEventType),
  scan_method: z.nativeEnum(ScanMethod).optional(),
  device_id: z.string().optional(),
  is_flagged: z.boolean().optional(),
  flag_reason: z.string().optional()
});

const updateGateLogBodySchema = createGateLogBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listGateLogsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  student_id: z.string().optional(),
  event_type: z.nativeEnum(GateEventType).optional(),
  scan_method: z.nativeEnum(ScanMethod).optional(),
  device_id: z.string().optional(),
  is_flagged: booleanQuery,
  date: z.string().optional()
});

export const createGateLogSchema = z.object({
  body: createGateLogBodySchema
});

export const updateGateLogSchema = z.object({
  params: gateLogIdParamSchema,
  body: updateGateLogBodySchema
});

export const listGateLogsSchema = z.object({
  query: listGateLogsQuerySchema
});
