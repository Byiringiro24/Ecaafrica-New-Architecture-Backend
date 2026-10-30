import { z } from "zod";

export const sendOtpSchema = z.object({
  phone: z.string().min(8).max(20)
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(8).max(20),
  otp: z.string().length(6)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

export const studentIdParamSchema = z.object({
  studentId: z.string().regex(/^\d+$/, "Invalid student ID")
});

export const dateRangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional()
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid calendar date");

export const leaveRequestSchema = z.object({
  leave_type: z.enum(["weekend", "emergency", "medical", "family", "other"]),
  start_date: isoDate,
  end_date: isoDate,
  reason: z.string().trim().min(3).max(1000).optional()
});

export const studentLeaveParamSchema = z.object({
  studentId: z.string().regex(/^\d+$/, "Invalid student ID"),
  leaveId: z.string().regex(/^\d+$/, "Invalid leave request ID")
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().regex(/^\d+$/, "Invalid notification ID")
});

export const studentInvoiceParamSchema = z.object({
  studentId: z.string().regex(/^\d+$/, "Invalid student ID"),
  invoiceId: z.string().regex(/^\d+$/, "Invalid invoice ID")
});
