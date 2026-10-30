import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import * as smsProviderService from "../../services/platform/sms-provider.service";

export const listSmsProviders = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const result = await smsProviderService.findAllSmsProviders(pagination);
  res.json(successResponse(result.data, result.meta));
};

export const getSmsProvider = async (req: Request, res: Response) => {
  const record = await smsProviderService.findSmsProviderById(req.params.id);
  res.json(successResponse(record));
};

export const createSmsProvider = async (req: Request, res: Response) => {
  const record = await smsProviderService.createSmsProvider(req.body);
  res.status(201).json(successResponse(record));
};

export const updateSmsProvider = async (req: Request, res: Response) => {
  const record = await smsProviderService.updateSmsProvider(req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteSmsProvider = async (req: Request, res: Response) => {
  const record = await smsProviderService.deleteSmsProvider(req.params.id);
  res.json(successResponse(record));
};
