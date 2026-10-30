import { BoardingSessionType } from "@prisma/client";
import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const dateInput = z.union([z.string(), z.date()]);

export const rollCallIdParamSchema = z.object({
  id: z.string().min(1)
});

export const createRollCallBodySchema = z.object({
  dormitory_id: idInput,
  roll_date: dateInput.optional(),
  session_type: z.nativeEnum(BoardingSessionType),
  conducted_by: idInput.optional(),
  notes: z.string().optional()
});
