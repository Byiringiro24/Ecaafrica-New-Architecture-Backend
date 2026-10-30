import { z } from "zod";

export const gatewayHeartbeatSchema = z.object({
  body: z.object({
    gateway_id: z.string().min(1),
    school_id: z.string().min(1).optional(),
    device_count: z.number().int().min(0).optional(),
    online: z.boolean().optional(),
    last_seen_at: z.string().datetime().optional(),
    firmware_version: z.string().max(64).optional(),
    battery_level: z.number().min(0).max(100).optional(),
    status: z.string().max(64).optional(),
    queue_depth: z.number().int().min(0).optional()
  })
});

export const gatewayPushSchema = z.object({
  body: z.object({
    gateway_id: z.string().min(1),
    school_id: z.string().min(1).optional(),
    records: z.array(
      z.object({
        local_id: z.string().min(1),
        record_type: z.string().min(1),
        payload: z.record(z.any()).optional().default({}),
        event_id: z.string().min(1).optional()
      })
    ).min(1)
  })
});

export const gatewayPullSchema = z.object({
  body: z.object({
    gateway_id: z.string().min(1),
    school_id: z.string().min(1).optional(),
    since: z.string().datetime().optional(),
    last_pull_at: z.string().datetime().optional(),
    sync_cursor: z.string().max(255).optional()
  })
});

export const gatewayCommandResultSchema = z.object({
  body: z.object({
    gateway_id: z.string().min(1),
    school_id: z.string().min(1).optional(),
    command_id: z.string().min(1),
    status: z.enum(["completed", "failed", "rejected"]).default("completed"),
    result: z.record(z.any()).optional(),
    error_message: z.string().max(500).optional()
  })
});
