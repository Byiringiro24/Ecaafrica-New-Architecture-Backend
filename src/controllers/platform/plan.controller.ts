import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import * as planService from "../../services/platform/plan.service";

export const createPlan = async (req: Request, res: Response) => {
  const plan = await planService.createPlan(req.body);
  res.status(201).json(successResponse(plan));
};

export const listPlans = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    is_active: req.query.is_active as boolean | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await planService.findAllPlans(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getPlan = async (req: Request, res: Response) => {
  const plan = await planService.findPlanById(req.params.id);
  res.json(successResponse(plan));
};

export const updatePlan = async (req: Request, res: Response) => {
  const plan = await planService.updatePlan(req.params.id, req.body);
  res.json(successResponse(plan));
};

export const deletePlan = async (req: Request, res: Response) => {
  const plan = await planService.softDeletePlan(req.params.id);
  res.json(successResponse(plan));
};
