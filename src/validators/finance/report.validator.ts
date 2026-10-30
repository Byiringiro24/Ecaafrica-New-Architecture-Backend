import { z } from "zod";

const periodQuerySchema = z.object({
  from_date: z.string().optional(),
  to_date: z.string().optional()
});

export const dashboardSummarySchema = z.object({ query: periodQuerySchema });

export const dailyCollectionsSchema = z.object({ query: periodQuerySchema });

export const monthlyCollectionsSchema = z.object({
  query: periodQuerySchema.extend({
    months: z.string().regex(/^\d{1,2}$/).optional()
  })
});

export const collectionReportSchema = z.object({ query: periodQuerySchema });

export const expensesByCategorySchema = z.object({ query: periodQuerySchema });

export const paymentMethodsSchema = z.object({ query: periodQuerySchema });

export const defaultersSchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d{1,3}$/).optional()
  })
});

export const payrollSummarySchema = z.object({
  query: z.object({
    payroll_run_id: z.string().regex(/^\d+$/).optional()
  })
});
