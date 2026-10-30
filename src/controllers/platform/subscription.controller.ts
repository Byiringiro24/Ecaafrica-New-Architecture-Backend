import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import * as subscriptionService from "../../services/platform/subscription.service";

export const createSubscription = async (req: Request, res: Response) => {
  const subscription = await subscriptionService.createSubscription(req.body);
  res.status(201).json(successResponse(subscription));
};

export const listSubscriptions = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    school_id: req.query.school_id as string | undefined,
    plan_id: req.query.plan_id as string | undefined
  };

  const result = await subscriptionService.findAllSubscriptions(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getSubscription = async (req: Request, res: Response) => {
  const subscription = await subscriptionService.findSubscriptionById(req.params.id);
  res.json(successResponse(subscription));
};

export const updateSubscription = async (req: Request, res: Response) => {
  const subscription = await subscriptionService.updateSubscription(req.params.id, req.body);
  res.json(successResponse(subscription));
};

export const deleteSubscription = async (req: Request, res: Response) => {
  const subscription = await subscriptionService.deleteSubscription(req.params.id);
  res.json(successResponse(subscription));
};
