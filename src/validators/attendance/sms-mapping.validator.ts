import { z } from "zod";

const templateId = z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).nullable().optional();

const body = z.object({
  source_type: z.string().min(1).max(50),
  event_type: z.string().min(1).max(50),
  scope_key: z.string().min(1).max(100).optional(),
  template_id: templateId,
  send_sms: z.boolean().optional()
});

export const upsertAttendanceSmsMappingSchema = z.object({ body });
