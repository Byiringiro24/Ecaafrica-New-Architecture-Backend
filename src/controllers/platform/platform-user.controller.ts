import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import * as platformUserService from "../../services/platform/platform-user.service";

export const createPlatformUser = async (req: Request, res: Response) => {
  const user = await platformUserService.createPlatformUser(req.body);
  res.status(201).json(successResponse(user));
};

export const listPlatformUsers = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    role: req.query.role as string | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await platformUserService.findAllPlatformUsers(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getPlatformUser = async (req: Request, res: Response) => {
  const user = await platformUserService.findPlatformUserById(req.params.id);
  res.json(successResponse(user));
};

export const updatePlatformUser = async (req: Request, res: Response) => {
  const user = await platformUserService.updatePlatformUser(req.params.id, req.body);
  res.json(successResponse(user));
};

export const deletePlatformUser = async (req: Request, res: Response) => {
  const user = await platformUserService.softDeletePlatformUser(req.params.id);
  res.json(successResponse(user));
};
