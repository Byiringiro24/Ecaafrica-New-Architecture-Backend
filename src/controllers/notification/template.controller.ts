import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as templateService from "../../services/notification/template.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (schoolId) {
    return schoolId;
  }

  if (req.user?.role === "platform_admin") {
    return null;
  }

  throw new AppError("forbidden", "Missing school context", 403);
};

const requirePlatformAdmin = (req: Request) => {
  if (req.user?.role !== "platform_admin") {
    throw new AppError(
      "forbidden",
      "Only a platform administrator can customize SMS templates",
      403
    );
  }
};

export const listTemplates = async (req: Request, res: Response) => {
  const schoolId = req.query.scope === "global" ? null : resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const activeFilter = typeof req.query.is_active === "string"
    ? req.query.is_active === "true"
    : undefined;
  const filters = {
    is_active: activeFilter,
    trigger_type: req.query.trigger_type as string | undefined
  };

  const result = await templateService.findAllTemplates(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getTemplate = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const record = await templateService.findTemplateById(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const createTemplate = async (req: Request, res: Response) => {
  // Platform admins create global templates; school admins create school-scoped templates
  const schoolId = resolveSchoolId(req);
  if (req.user?.role !== "platform_admin" && req.user?.role !== "school_admin") {
    throw new AppError("forbidden", "Only school or platform admins can create SMS templates", 403);
  }
  const record = await templateService.createTemplate(schoolId, req.body);
  res.status(201).json(successResponse(record));
};

export const updateTemplate = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  // School admins can only update their own school-scoped templates
  if (req.user?.role !== "platform_admin") {
    const existing = await templateService.findTemplateById(schoolId, req.params.id);
    if (!existing || existing.school_id === null) {
      throw new AppError("forbidden", "You can only edit your own school SMS templates. Global templates can only be edited by the platform admin.", 403);
    }
  }
  const record = await templateService.updateTemplate(schoolId, req.params.id, req.body);
  res.json(successResponse(record));
};

export const deleteTemplate = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  if (req.user?.role !== "platform_admin") {
    const existing = await templateService.findTemplateById(schoolId, req.params.id);
    if (!existing || existing.school_id === null) {
      throw new AppError("forbidden", "You can only delete your own school SMS templates.", 403);
    }
  }
  const record = await templateService.deleteTemplate(schoolId, req.params.id);
  res.json(successResponse(record));
};

export const renderTemplate = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const result = await templateService.renderTemplateById(
    schoolId,
    req.params.id,
    req.body.variables ?? {},
    req.body.language ?? "en"
  );
  res.json(successResponse(result));
};

/**
 * PATCH /notifications/templates/:id/approve
 * Platform admin only — approves a school-submitted template by setting is_active=true.
 */
export const approveTemplate = async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  const record = await templateService.updateTemplate(null, req.params.id, { is_active: true });
  res.json(successResponse(record));
};

/**
 * PATCH /notifications/templates/:id/reject
 * Platform admin only — rejects a school-submitted template by setting is_active=false
 * (it stays in DB but won't be used).
 */
export const rejectTemplate = async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  const record = await templateService.updateTemplate(null, req.params.id, { is_active: false });
  res.json(successResponse(record));
};

/**
 * GET /notifications/templates/pending
 * Platform admin only — lists all school-submitted templates awaiting approval.
 */
export const listPendingTemplates = async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  const { prisma } = await import("../../database/prisma");
  const rows = await prisma.notification_templates.findMany({
    where: { school_id: { not: null }, is_active: false },
    include: { school: { select: { id: true, name: true } } },
    orderBy: { created_at: "desc" },
    take: 100,
  });
  res.json(successResponse(rows.map(r => ({
    ...r,
    id: r.id.toString(),
    school_id: r.school_id?.toString() ?? null,
    school_name: (r as any).school?.name ?? null,
  }))));
};
