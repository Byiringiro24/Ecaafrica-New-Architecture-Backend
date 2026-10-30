import type {
  Prisma,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketSenderType,
  SupportTicketStatus,
  support_ticket_messages,
  support_tickets
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value);
};

const toDateValue = (value: string | Date | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

type TicketCreateInput = {
  school_id: string | number | bigint;
  opened_by?: string | number | bigint | null;
  assigned_to?: string | number | bigint | null;
  subject: string;
  category?: string;
  priority?: string;
  status?: string;
  resolved_at?: string | Date | null;
};

type TicketUpdateInput = Partial<TicketCreateInput>;

type TicketFilters = {
  status?: string;
  priority?: string;
  category?: string;
  school_id?: string;
  assigned_to?: string;
};

type MessageCreateInput = {
  ticket_id: string | number | bigint;
  sender_type: string;
  sender_id: string | number | bigint;
  body: string;
  is_internal?: boolean;
};

type MessageUpdateInput = Partial<Omit<MessageCreateInput, "ticket_id">>;

type TicketRecord = support_tickets;

type MessageRecord = support_ticket_messages;

const formatTicket = (ticket: TicketRecord) => ({
  ...ticket,
  id: ticket.id.toString(),
  school_id: ticket.school_id.toString(),
  opened_by: ticket.opened_by ? ticket.opened_by.toString() : null,
  assigned_to: ticket.assigned_to ? ticket.assigned_to.toString() : null
});

const enrichTickets = async (tickets: TicketRecord[]) => {
  const schoolIds = [...new Set(tickets.map((ticket) => ticket.school_id.toString()))].map(toBigInt);
  const openerIds = [...new Set(tickets.filter((ticket) => ticket.opened_by).map((ticket) => ticket.opened_by!.toString()))].map(toBigInt);

  const [schools, openers] = await prisma.$transaction([
    prisma.schools.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true, school_email: true } }),
    prisma.users.findMany({ where: { id: { in: openerIds } }, select: { id: true, name: true, email: true, role: true } })
  ]);

  const schoolById = new Map(schools.map((school) => [school.id.toString(), school]));
  const openerById = new Map(openers.map((opener) => [opener.id.toString(), opener]));

  return tickets.map((ticket) => {
    const formatted = formatTicket(ticket);
    const school = schoolById.get(ticket.school_id.toString());
    const opener = ticket.opened_by ? openerById.get(ticket.opened_by.toString()) : undefined;
    return {
      ...formatted,
      school_name: school?.name ?? null,
      school_email: school?.school_email ?? null,
      sender_name: opener?.name ?? null,
      sender_email: opener?.email ?? null,
      sender_role: opener?.role ?? null,
      source: ticket.audience === "school_admin" ? "gate_keeper" : "school_admin"
    };
  });
};

const formatMessage = (message: MessageRecord) => ({
  ...message,
  id: message.id.toString(),
  ticket_id: message.ticket_id.toString(),
  sender_id: message.sender_id.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "resolved_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.support_ticketsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.support_ticketsOrderByWithRelationInput;
};

export const createSupportTicket = async (input: TicketCreateInput) => {
  const ticketNumber = `TCK-${Date.now().toString(36).toUpperCase()}`;

  const created = await prisma.support_tickets.create({
    data: {
      ticket_number: ticketNumber,
      school_id: toBigInt(input.school_id),
      opened_by:
        input.opened_by !== undefined && input.opened_by !== null
          ? toBigInt(input.opened_by)
          : undefined,
      assigned_to:
        input.assigned_to !== undefined && input.assigned_to !== null
          ? toBigInt(input.assigned_to)
          : undefined,
      subject: input.subject,
      category: (input.category as SupportTicketCategory) ?? undefined,
      priority: (input.priority as SupportTicketPriority) ?? undefined,
      status: (input.status as SupportTicketStatus) ?? undefined,
      resolved_at: toDateValue(input.resolved_at) ?? undefined
    }
  });

  return formatTicket(created);
};

export const findAllSupportTickets = async (
  pagination: PaginationParams,
  filters: TicketFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.support_ticketsWhereInput = {};

  // Platform support handles tickets explicitly addressed to system administrators.
  where.audience = "platform_admin";

  if (filters.status) where.status = filters.status as SupportTicketStatus;
  if (filters.priority) where.priority = filters.priority as SupportTicketPriority;
  if (filters.category) where.category = filters.category as SupportTicketCategory;
  if (filters.school_id) where.school_id = toBigInt(filters.school_id);
  if (filters.assigned_to) where.assigned_to = toBigInt(filters.assigned_to);

  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { ticket_number: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.support_tickets.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.support_tickets.count({ where })
  ]);

  return {
    data: await enrichTickets(items),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findSupportTicketById = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid support ticket id", 400);
  }

  const ticket = await prisma.support_tickets.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!ticket) {
    throw new AppError("not_found", "Support ticket not found", 404);
  }

  return (await enrichTickets([ticket]))[0];
};

export const updateSupportTicket = async (id: string, input: TicketUpdateInput) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid support ticket id", 400);
  }

  const existing = await prisma.support_tickets.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Support ticket not found", 404);
  }

  const updated = await prisma.support_tickets.update({
    where: { id: existing.id },
    data: {
      school_id: input.school_id ? toBigInt(input.school_id) : undefined,
      opened_by:
        input.opened_by !== undefined && input.opened_by !== null
          ? toBigInt(input.opened_by)
          : undefined,
      assigned_to:
        input.assigned_to !== undefined && input.assigned_to !== null
          ? toBigInt(input.assigned_to)
          : undefined,
      subject: input.subject ?? undefined,
      category: input.category
        ? (input.category as SupportTicketCategory)
        : undefined,
      priority: input.priority
        ? (input.priority as SupportTicketPriority)
        : undefined,
      status: input.status ? (input.status as SupportTicketStatus) : undefined,
      resolved_at: toDateValue(input.resolved_at)
    }
  });

  return formatTicket(updated);
};

export const deleteSupportTicket = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid support ticket id", 400);
  }

  const existing = await prisma.support_tickets.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Support ticket not found", 404);
  }

  const deleted = await prisma.support_tickets.delete({
    where: { id: existing.id }
  });

  return formatTicket(deleted);
};

export const createSupportTicketMessage = async (input: MessageCreateInput) => {
  const created = await prisma.support_ticket_messages.create({
    data: {
      ticket_id: toBigInt(input.ticket_id),
      sender_type: input.sender_type as SupportTicketSenderType,
      sender_id: toBigInt(input.sender_id),
      body: input.body,
      is_internal: input.is_internal ?? undefined
    }
  });

  return formatMessage(created);
};

export const findAllSupportTicketMessages = async (ticketId: string) => {
  if (!/^\d+$/.test(ticketId)) {
    throw new AppError("bad_request", "Invalid support ticket id", 400);
  }

  const items = await prisma.support_ticket_messages.findMany({
    where: { ticket_id: toBigInt(ticketId) },
    orderBy: { created_at: "asc" }
  });

  return items.map((item) => formatMessage(item));
};

export const findSupportTicketMessageById = async (ticketId: string, messageId: string) => {
  if (!/^\d+$/.test(ticketId) || !/^\d+$/.test(messageId)) {
    throw new AppError("bad_request", "Invalid support ticket message id", 400);
  }

  const message = await prisma.support_ticket_messages.findFirst({
    where: { id: toBigInt(messageId), ticket_id: toBigInt(ticketId) }
  });

  if (!message) {
    throw new AppError("not_found", "Support ticket message not found", 404);
  }

  return formatMessage(message);
};

export const updateSupportTicketMessage = async (
  ticketId: string,
  messageId: string,
  input: MessageUpdateInput
) => {
  if (!/^\d+$/.test(ticketId) || !/^\d+$/.test(messageId)) {
    throw new AppError("bad_request", "Invalid support ticket message id", 400);
  }

  const existing = await prisma.support_ticket_messages.findFirst({
    where: { id: toBigInt(messageId), ticket_id: toBigInt(ticketId) }
  });

  if (!existing) {
    throw new AppError("not_found", "Support ticket message not found", 404);
  }

  const updated = await prisma.support_ticket_messages.update({
    where: { id: existing.id },
    data: {
      sender_type: input.sender_type
        ? (input.sender_type as SupportTicketSenderType)
        : undefined,
      sender_id: input.sender_id ? toBigInt(input.sender_id) : undefined,
      body: input.body ?? undefined,
      is_internal: input.is_internal ?? undefined
    }
  });

  return formatMessage(updated);
};

export const deleteSupportTicketMessage = async (ticketId: string, messageId: string) => {
  if (!/^\d+$/.test(ticketId) || !/^\d+$/.test(messageId)) {
    throw new AppError("bad_request", "Invalid support ticket message id", 400);
  }

  const existing = await prisma.support_ticket_messages.findFirst({
    where: { id: toBigInt(messageId), ticket_id: toBigInt(ticketId) }
  });

  if (!existing) {
    throw new AppError("not_found", "Support ticket message not found", 404);
  }

  const deleted = await prisma.support_ticket_messages.delete({
    where: { id: existing.id }
  });

  return formatMessage(deleted);
};
