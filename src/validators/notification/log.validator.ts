import { z } from "zod";

const listNotificationLogsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(["queued", "sent", "delivered", "failed", "retry"]).optional(),
  channel: z.enum(["sms", "email", "push", "in_app"]).optional(),
  recipient_type: z
    .enum(["parent", "student", "staff", "admin", "school"])
    .optional(),
  from: z.string().optional(),
  to: z.string().optional()
});

export const listNotificationLogsSchema = z.object({
  query: listNotificationLogsQuerySchema
});
