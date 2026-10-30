import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import * as service from "../services/school-support-ticket.service";

const user = (req: Request) => req.user as { id: string | number; school_id?: string | number; role: string };
export const list = async (req: Request, res: Response) => res.json(successResponse(await service.list(user(req))));
export const create = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.create(user(req), req.body)));
export const get = async (req: Request, res: Response) => res.json(successResponse(await service.get(user(req), req.params.id)));
export const reply = async (req: Request, res: Response) => res.status(201).json(successResponse(await service.reply(user(req), req.params.id, req.body.body)));
export const update = async (req: Request, res: Response) => res.json(successResponse(await service.update(user(req), req.params.id, req.body.status)));
