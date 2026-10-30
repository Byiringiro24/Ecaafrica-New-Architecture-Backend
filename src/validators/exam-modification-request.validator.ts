import { z } from "zod";

export const createModificationRequestSchema = z.object({
  params: z.object({ examId: z.string().regex(/^\d+$/) }),
  body: z.object({ reason: z.string().trim().min(5).max(1000) })
});

export const reviewModificationRequestSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({ status: z.enum(["approved", "rejected"]) })
});
