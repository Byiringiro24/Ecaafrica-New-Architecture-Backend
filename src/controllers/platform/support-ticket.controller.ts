import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import * as supportTicketService from "../../services/platform/support-ticket.service";

export const createSupportTicket = async (req: Request, res: Response) => {
  const ticket = await supportTicketService.createSupportTicket(req.body);
  res.status(201).json(successResponse(ticket));
};

export const listSupportTickets = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    priority: req.query.priority as string | undefined,
    category: req.query.category as string | undefined,
    school_id: req.query.school_id as string | undefined,
    assigned_to: req.query.assigned_to as string | undefined
  };

  const result = await supportTicketService.findAllSupportTickets(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getSupportTicket = async (req: Request, res: Response) => {
  const ticket = await supportTicketService.findSupportTicketById(req.params.id);
  res.json(successResponse(ticket));
};

export const updateSupportTicket = async (req: Request, res: Response) => {
  const ticket = await supportTicketService.updateSupportTicket(req.params.id, req.body);
  res.json(successResponse(ticket));
};

export const deleteSupportTicket = async (req: Request, res: Response) => {
  const ticket = await supportTicketService.deleteSupportTicket(req.params.id);
  res.json(successResponse(ticket));
};

export const createSupportTicketMessage = async (req: Request, res: Response) => {
  const message = await supportTicketService.createSupportTicketMessage({
    ticket_id: req.params.id,
    sender_type: req.body.sender_type,
    sender_id: req.body.sender_id,
    body: req.body.body,
    is_internal: req.body.is_internal
  });

  res.status(201).json(successResponse(message));
};

export const listSupportTicketMessages = async (req: Request, res: Response) => {
  const messages = await supportTicketService.findAllSupportTicketMessages(req.params.id);
  res.json(successResponse(messages));
};

export const getSupportTicketMessage = async (req: Request, res: Response) => {
  const message = await supportTicketService.findSupportTicketMessageById(
    req.params.id,
    req.params.messageId
  );
  res.json(successResponse(message));
};

export const updateSupportTicketMessage = async (req: Request, res: Response) => {
  const message = await supportTicketService.updateSupportTicketMessage(
    req.params.id,
    req.params.messageId,
    req.body
  );
  res.json(successResponse(message));
};

export const deleteSupportTicketMessage = async (req: Request, res: Response) => {
  const message = await supportTicketService.deleteSupportTicketMessage(
    req.params.id,
    req.params.messageId
  );
  res.json(successResponse(message));
};
