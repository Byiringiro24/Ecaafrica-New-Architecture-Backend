import { z } from "zod";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const timeInput = z.union([z.string(), z.date()]);

export const timetablePeriodIdParamSchema = z.object({
  id: z.string().min(1)
});

const createTimetablePeriodBodySchema = z.object({
  name: z.string().min(1),
  start_time: timeInput,
  end_time: timeInput,
  is_break: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

const updateTimetablePeriodBodySchema = createTimetablePeriodBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listTimetablePeriodsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  include_deleted: booleanQuery
});

export const createTimetablePeriodSchema = z.object({
  body: createTimetablePeriodBodySchema
});

export const updateTimetablePeriodSchema = z.object({
  params: timetablePeriodIdParamSchema,
  body: updateTimetablePeriodBodySchema
});

export const listTimetablePeriodsSchema = z.object({
  query: listTimetablePeriodsQuerySchema
});
