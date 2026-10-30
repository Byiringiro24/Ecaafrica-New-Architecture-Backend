import { BoardingRollStatus, BoardingSessionType } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const rollCallIdParamSchema = z.object({
  id: z.string().min(1)
});

const createRollCallBodySchema = z.object({
  dormitory_id: idInput,
  roll_date: dateInput.optional(),
  session_type: z.nativeEnum(BoardingSessionType),
  conducted_by: idInput.optional(),
  notes: z.string().optional()
});

const updateRollCallBodySchema = z
  .object({
    dormitory_id: idInput.optional(),
    roll_date: dateInput.optional(),
    session_type: z.nativeEnum(BoardingSessionType).optional(),
    conducted_by: idInput.nullable().optional(),
    submitted_at: dateInput.nullable().optional(),
    notes: z.string().nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listRollCallsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  dormitory_id: z.string().optional(),
  roll_date: z.string().optional(),
  session_type: z.nativeEnum(BoardingSessionType).optional()
});

const createRollCallRecordBodySchema = z.object({
  student_id: idInput,
  status: z.nativeEnum(BoardingRollStatus),
  notes: z.string().optional()
});

const bulkRollCallRecordBodySchema = z.object({
  records: z.array(createRollCallRecordBodySchema).min(1)
});

export const createRollCallSchema = z.object({
  body: createRollCallBodySchema
});

export const updateRollCallSchema = z.object({
  params: rollCallIdParamSchema,
  body: updateRollCallBodySchema
});

export const listRollCallsSchema = z.object({
  query: listRollCallsQuerySchema
});

export const createRollCallRecordSchema = z.object({
  params: rollCallIdParamSchema,
  body: createRollCallRecordBodySchema
});

export const bulkRollCallRecordSchema = z.object({
  params: rollCallIdParamSchema,
  body: bulkRollCallRecordBodySchema
});
