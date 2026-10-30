import { z } from "zod";

const listAuditLogsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  actor_id: z.string().optional(),
  actor_type: z
    .enum(["platform_user", "school_user", "system", "api"])
    .optional(),
  action: z.string().optional(),
  resource_type: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  from: z.string().optional(),
  to: z.string().optional()
});

export const listAuditLogsSchema = z.object({
  query: listAuditLogsQuerySchema
});
