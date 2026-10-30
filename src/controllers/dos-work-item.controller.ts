import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as service from "../services/dos-work-item.service";

const school = (req: Request) => {
  if (!req.user?.school_id) throw new AppError("forbidden", "Missing school context", 403);
  return req.user.school_id;
};
const actor = (req: Request) => ({ id: req.user?.id, role: req.user?.role, name: typeof req.user?.name === "string" ? req.user.name : undefined });

export const list = async (req: Request, res: Response) => res.json(successResponse(await service.listDosWorkItems(school(req), req.query)));
export const summary = async (req: Request, res: Response) => res.json(successResponse(await service.getDosWorkItemSummary(school(req))));
export const get = async (req: Request, res: Response) => res.json(successResponse(await service.getDosWorkItem(school(req), req.params.id)));
export const create = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.createDosWorkItem(school(req), req.body, actor(req))));
export const update = async (req: Request, res: Response) => res.json(successResponse(await service.updateDosWorkItem(school(req), req.params.id, req.body, actor(req))));
export const remove = async (req: Request, res: Response) => res.json(successResponse(await service.deleteDosWorkItem(school(req), req.params.id, actor(req))));
