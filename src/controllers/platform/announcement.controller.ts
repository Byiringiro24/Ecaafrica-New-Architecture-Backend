import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import * as announcementService from "../../services/platform/announcement.service";

export const createAnnouncement = async (req: Request, res: Response) => {
  const payload = {
    ...req.body,
    created_by: req.user?.id
  };
  const announcement = await announcementService.createAnnouncement(payload);
  res.status(201).json(successResponse(announcement));
};

export const listAnnouncements = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    type: req.query.type as string | undefined,
    target_scope: req.query.target_scope as string | undefined
  };

  const result = await announcementService.findAllAnnouncements(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getAnnouncement = async (req: Request, res: Response) => {
  const announcement = await announcementService.findAnnouncementById(req.params.id);
  res.json(successResponse(announcement));
};

export const updateAnnouncement = async (req: Request, res: Response) => {
  const announcement = await announcementService.updateAnnouncement(req.params.id, req.body);
  res.json(successResponse(announcement));
};

export const deleteAnnouncement = async (req: Request, res: Response) => {
  const announcement = await announcementService.deleteAnnouncement(req.params.id);
  res.json(successResponse(announcement));
};

export const markAnnouncementRead = async (req: Request, res: Response) => {
  const read = await announcementService.markAnnouncementRead({
    announcement_id: req.params.id,
    school_id: req.body.school_id,
    user_id: req.body.user_id ?? null
  });

  res.json(successResponse(read));
};
