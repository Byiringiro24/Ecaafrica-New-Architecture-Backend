import { z } from "zod";

export const rollCallSummaryParamSchema = z.object({
  id: z.string().min(1)
});
