import type { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import { successResponse } from "../helpers/response";
import { prisma } from "../database/prisma";
import * as schoolService from "../services/platform/school.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId.toString();
};

export const getCurrentSchoolProfile = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);

  const school = await prisma.schools.findFirst({
    where: { id: BigInt(schoolId), deleted_at: null },
    select: {
      id: true,
      name: true,
      logo_url: true,
      country: true,
      province: true,
      district: true,
      sector: true,
      website: true,
      school_phone: true,
      school_email: true,
      principal_name: true
    }
  });

  if (!school) {
    throw new AppError("not_found", "School not found", 404);
  }

  res.json(successResponse({ ...school, id: school.id.toString() }));
};

export const updateCurrentSchoolLogo = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);

  if (!req.file) {
    throw new AppError("bad_request", "Logo file is required", 400);
  }

  const logoUrl = `/uploads/logos/${req.file.filename}`;
  const school = await schoolService.updateSchool(schoolId, { logo_url: logoUrl });

  res.json(successResponse(school));
};

export const getCurrentSchoolSubscription = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const subscription = await prisma.school_subscriptions.findFirst({
    where: { school_id: BigInt(schoolId) },
    include: { plan: true },
    orderBy: { starts_at: "desc" }
  });
  if (!subscription) throw new AppError("not_found", "No subscription assigned to this school", 404);
  res.json(successResponse({
    ...subscription,
    id: subscription.id.toString(),
    school_id: subscription.school_id.toString(),
    plan_id: subscription.plan_id.toString(),
    created_by: subscription.created_by?.toString() ?? null,
    plan: { ...subscription.plan, id: subscription.plan.id.toString() }
  }));
};

export const updateCurrentSchoolSubscription = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const existing = await prisma.school_subscriptions.findFirst({
    where: { school_id: BigInt(schoolId) }, orderBy: { starts_at: "desc" }
  });
  if (!existing) throw new AppError("not_found", "No subscription assigned to this school", 404);
  const allowed = { auto_renew: req.body?.auto_renew, notes: req.body?.notes };
  const updated = await prisma.school_subscriptions.update({ where: { id: existing.id }, data: {
    auto_renew: typeof allowed.auto_renew === "boolean" ? allowed.auto_renew : undefined,
    notes: allowed.notes === null || typeof allowed.notes === "string" ? allowed.notes : undefined
  }, include: { plan: true } });
  res.json(successResponse({ ...updated, id: updated.id.toString(), school_id: updated.school_id.toString(), plan_id: updated.plan_id.toString(), created_by: updated.created_by?.toString() ?? null, plan: { ...updated.plan, id: updated.plan.id.toString() } }));
};
