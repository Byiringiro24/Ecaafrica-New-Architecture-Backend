import { z } from "zod";
import { HolidayType } from "@prisma/client";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const dateInput = z.union([z.string(), z.date()]);

export const holidayIdParamSchema = z.object({
  id: z.string().min(1)
});

const createHolidayBodySchema = z.object({
  name: z.string().min(2),
  start_date: dateInput,
  end_date: dateInput,
  type: z.nativeEnum(HolidayType).optional()
});

const updateHolidayBodySchema = createHolidayBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listHolidaysQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  include_deleted: booleanQuery
});

export const createHolidaySchema = z.object({
  body: createHolidayBodySchema
});

export const updateHolidaySchema = z.object({
  params: holidayIdParamSchema,
  body: updateHolidayBodySchema
});

export const listHolidaysSchema = z.object({
  query: listHolidaysQuerySchema
});
