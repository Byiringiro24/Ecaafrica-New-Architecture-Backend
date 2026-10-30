import { BoardingRollStatus } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);

export const rollCallIdParamSchema = z.object({
  id: z.string().min(1)
});

export const rollCallRecordBodySchema = z.object({
  student_id: idInput,
  status: z.nativeEnum(BoardingRollStatus),
  notes: z.string().optional()
});

export const createRollCallRecordSchema = z.object({
  params: rollCallIdParamSchema,
  body: rollCallRecordBodySchema
});

export const bulkRollCallRecordSchema = z.object({
  params: rollCallIdParamSchema,
  body: z.object({
    records: z.array(rollCallRecordBodySchema).min(1)
  })
});
