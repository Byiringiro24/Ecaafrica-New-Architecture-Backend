import { z } from "zod";

export const listFinanceAuditSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    q: z.string().optional(),
    module: z.string().optional(),
    resource_type: z.string().optional(),
    actor_id: z.string().regex(/^\d+$/).optional(),
    action: z.string().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional()
  })
});
