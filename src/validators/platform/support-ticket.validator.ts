import { z } from "zod";
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketSenderType,
  SupportTicketStatus
} from "@prisma/client";

const dateInput = z.union([z.string(), z.date()]).nullable().optional();

export const supportTicketIdParamSchema = z.object({
  id: z.string().min(1)
});

export const supportTicketMessageIdParamSchema = z.object({
  id: z.string().min(1),
  messageId: z.string().min(1)
});

const createSupportTicketBodySchema = z.object({
  school_id: z.union([z.string(), z.number()]),
  opened_by: z.union([z.string(), z.number()]).nullable().optional(),
  assigned_to: z.union([z.string(), z.number()]).nullable().optional(),
  subject: z.string().min(2),
  category: z.nativeEnum(SupportTicketCategory).optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  status: z.nativeEnum(SupportTicketStatus).optional(),
  resolved_at: dateInput
});

const updateSupportTicketBodySchema = createSupportTicketBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const listSupportTicketsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  status: z.nativeEnum(SupportTicketStatus).optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  category: z.nativeEnum(SupportTicketCategory).optional(),
  school_id: z.string().optional(),
  assigned_to: z.string().optional()
});

const createMessageBodySchema = z.object({
  sender_type: z.nativeEnum(SupportTicketSenderType),
  sender_id: z.union([z.string(), z.number()]),
  body: z.string().min(1),
  is_internal: z.boolean().optional()
});

const updateMessageBodySchema = createMessageBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

export const createSupportTicketSchema = z.object({
  body: createSupportTicketBodySchema
});

export const updateSupportTicketSchema = z.object({
  params: supportTicketIdParamSchema,
  body: updateSupportTicketBodySchema
});

export const listSupportTicketsSchema = z.object({
  query: listSupportTicketsQuerySchema
});

export const createSupportTicketMessageSchema = z.object({
  params: supportTicketIdParamSchema,
  body: createMessageBodySchema
});

export const updateSupportTicketMessageSchema = z.object({
  params: supportTicketMessageIdParamSchema,
  body: updateMessageBodySchema
});
