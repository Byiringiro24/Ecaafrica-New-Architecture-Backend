import { z } from "zod";
import { SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from "@prisma/client";

export const schoolTicketIdSchema = z.object({ id: z.string().regex(/^\d+$/) });

export const createSchoolTicketSchema = z.object({
  subject: z.string().trim().min(2).max(255),
  category: z.nativeEnum(SupportTicketCategory).default(SupportTicketCategory.technical),
  priority: z.nativeEnum(SupportTicketPriority).default(SupportTicketPriority.medium),
  body: z.string().trim().min(1).max(5000)
});

export const schoolTicketMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000)
});

export const updateSchoolTicketSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus)
});
