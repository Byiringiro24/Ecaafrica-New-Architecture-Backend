import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);

export const leaveBalanceIdParamSchema = z.object({
  id: z.string().min(1)
});

const createLeaveBalanceBodySchema = z.object({
  staff_id: idInput,
  academic_year_id: idInput,
  annual_days: z.number().int().nonnegative().optional(),
  sick_days: z.number().int().nonnegative().optional(),
  emergency_days: z.number().int().nonnegative().optional()
});

const updateLeaveBalanceBodySchema = z
  .object({
    annual_days: z.number().int().nonnegative().optional(),
    sick_days: z.number().int().nonnegative().optional(),
    emergency_days: z.number().int().nonnegative().optional(),
    annual_used: z.number().int().nonnegative().optional(),
    sick_used: z.number().int().nonnegative().optional(),
    emergency_used: z.number().int().nonnegative().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const deductLeaveBalanceBodySchema = z.object({
  leave_type: z.enum(["annual", "sick", "emergency"]),
  days: z.number().int().positive()
});

const listLeaveBalancesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  staff_id: z.string().optional(),
  academic_year_id: z.string().optional()
});

export const createLeaveBalanceSchema = z.object({
  body: createLeaveBalanceBodySchema
});

export const updateLeaveBalanceSchema = z.object({
  params: leaveBalanceIdParamSchema,
  body: updateLeaveBalanceBodySchema
});

export const deductLeaveBalanceSchema = z.object({
  params: leaveBalanceIdParamSchema,
  body: deductLeaveBalanceBodySchema
});

export const listLeaveBalancesSchema = z.object({
  query: listLeaveBalancesQuerySchema
});
