import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import * as service from "../services/demo-request.service";

export const create = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.createDemoRequest(req.body)));
export const list = async (_req: Request, res: Response) => res.json(successResponse(await service.listDemoRequests()));
export const update = async (req: Request, res: Response) => res.json(successResponse(await service.updateDemoRequest(req.params.id, req.body.status)));
export const remove = async (req: Request, res: Response) => { await service.deleteDemoRequest(req.params.id); res.json(successResponse({ deleted: true })); };
