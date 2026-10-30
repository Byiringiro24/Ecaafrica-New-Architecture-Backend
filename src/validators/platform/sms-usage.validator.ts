import { z } from "zod";

const dateValue = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid date"
});

export const smsUsageQuerySchema = z.object({
  query: z.object({
    from: dateValue.optional(),
    to: dateValue.optional(),
    school_id: z.string().regex(/^\d+$/).optional()
  })
});
