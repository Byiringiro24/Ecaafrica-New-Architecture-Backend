import {
  Prisma,
  SupportTicketAudience,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketSenderType,
  SupportTicketStatus,
} from "@prisma/client";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type SchoolUser = {
  id: string | number;
  school_id?: string | number;
  role: string;
};
const big = (value: string | number) => BigInt(value);
const isAdmin = (user: SchoolUser) => user.role === "school_admin";
const isGateKeeper = (user: SchoolUser) => user.role === "gate_keeper";

const formatMessage = (message: any) => ({
  ...message,
  id: message.id.toString(),
  ticket_id: message.ticket_id.toString(),
  sender_id: message.sender_id.toString(),
});
const formatTicket = (ticket: any) => ({
  ...ticket,
  id: ticket.id.toString(),
  school_id: ticket.school_id.toString(),
  opened_by: ticket.opened_by?.toString() ?? null,
  assigned_to: ticket.assigned_to?.toString() ?? null,
  source:
    ticket.audience === SupportTicketAudience.school_admin
      ? "gate_keeper"
      : "school_admin",
  messages: ticket.messages?.map(formatMessage) ?? [],
});

const schoolId = (user: SchoolUser) => {
  if (!user.school_id)
    throw new AppError("forbidden", "Missing school context", 403);
  return big(user.school_id);
};

const accessibleWhere = (
  user: SchoolUser,
): Prisma.support_ticketsWhereInput => {
  const school = schoolId(user);
  if (isGateKeeper(user))
    return {
      school_id: school,
      audience: SupportTicketAudience.school_admin,
      opened_by: big(user.id),
    };
  return { school_id: school };
};

const getAccessibleTicket = async (user: SchoolUser, id: string) => {
  const ticket = await prisma.support_tickets.findFirst({
    where: { id: big(id), ...accessibleWhere(user) },
    include: { messages: { orderBy: { created_at: "asc" } } },
  });
  if (!ticket) throw new AppError("not_found", "Support ticket not found", 404);
  return ticket;
};

export const list = async (user: SchoolUser) => {
  const tickets = await prisma.support_tickets.findMany({
    where: accessibleWhere(user),
    include: { messages: { orderBy: { created_at: "asc" } } },
    orderBy: { updated_at: "desc" },
  });
  return tickets.map(formatTicket);
};

export const create = async (
  user: SchoolUser,
  input: {
    subject: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    body: string;
  },
) => {
  if (!isAdmin(user) && !isGateKeeper(user))
    throw new AppError(
      "forbidden",
      "Only school administrators and gate keepers can create tickets",
      403,
    );
  const ticket = await prisma.support_tickets.create({
    data: {
      ticket_number: `TCK-${Date.now().toString(36).toUpperCase()}`,
      school_id: schoolId(user),
      opened_by: big(user.id),
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      audience: isGateKeeper(user)
        ? SupportTicketAudience.school_admin
        : SupportTicketAudience.platform_admin,
      messages: {
        create: {
          sender_type: SupportTicketSenderType.school_user,
          sender_id: big(user.id),
          body: input.body,
        },
      },
    },
    include: { messages: true },
  });
  return formatTicket(ticket);
};

export const get = async (user: SchoolUser, id: string) =>
  formatTicket(await getAccessibleTicket(user, id));

export const reply = async (user: SchoolUser, id: string, body: string) => {
  const ticket = await getAccessibleTicket(user, id);
  if (ticket.status === SupportTicketStatus.closed)
    throw new AppError(
      "bad_request",
      "Closed support tickets cannot receive replies",
      400,
    );
  if (
    isGateKeeper(user) &&
    (ticket.audience !== SupportTicketAudience.school_admin ||
      ticket.opened_by?.toString() !== user.id.toString())
  )
    throw new AppError("forbidden", "You cannot reply to this ticket", 403);
  const message = await prisma.support_ticket_messages.create({
    data: {
      ticket_id: ticket.id,
      sender_type: SupportTicketSenderType.school_user,
      sender_id: big(user.id),
      body,
    },
  });
  await prisma.support_tickets.update({
    where: { id: ticket.id },
    data: {
      status:
        isAdmin(user) && ticket.status === SupportTicketStatus.open
          ? SupportTicketStatus.in_progress
          : undefined,
    },
  });
  return formatMessage(message);
};

export const update = async (
  user: SchoolUser,
  id: string,
  status: SupportTicketStatus,
) => {
  if (!isAdmin(user))
    throw new AppError(
      "forbidden",
      "Only school administrators can update ticket status",
      403,
    );
  const ticket = await getAccessibleTicket(user, id);
  if (ticket.audience !== SupportTicketAudience.school_admin) {
    throw new AppError(
      "forbidden",
      "System-admin ticket status is managed by the system administrator",
      403,
    );
  }
  return formatTicket(
    await prisma.support_tickets.update({
      where: { id: ticket.id },
      data: {
        status,
        resolved_at:
          status === SupportTicketStatus.resolved ||
          status === SupportTicketStatus.closed
            ? new Date()
            : null,
      },
      include: { messages: true },
    }),
  );
};
