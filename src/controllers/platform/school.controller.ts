import type { Request, Response } from "express";
import { parsePagination } from "../../helpers/pagination";
import { successResponse } from "../../helpers/response";
import * as auditService from "../../services/audit.service";
import * as userService from "../../services/user.service";
import * as schoolService from "../../services/platform/school.service";

export const createSchool = async (req: Request, res: Response) => {
  const school = await schoolService.createSchool(req.body);
  res.status(201).json(successResponse(school));
};

export const listSchools = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    exclude_status: req.query.exclude_status as string | undefined,
    province: req.query.province as string | undefined,
    district: req.query.district as string | undefined,
    country: req.query.country as string | undefined,
    school_type: req.query.school_type as string | undefined,
    subscription_plan_id: req.query.subscription_plan_id as string | undefined,
    has_boarding: req.query.has_boarding as boolean | undefined,
    has_biometrics: req.query.has_biometrics as boolean | undefined,
    has_gate: req.query.has_gate as boolean | undefined,
    has_visitor_mgmt: req.query.has_visitor_mgmt as boolean | undefined,
    has_exam_system: req.query.has_exam_system as boolean | undefined,
    has_salary_mgmt: req.query.has_salary_mgmt as boolean | undefined,
    has_parent_app: req.query.has_parent_app as boolean | undefined,
    has_bulk_sms: req.query.has_bulk_sms as boolean | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await schoolService.findAllSchools(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getSchool = async (req: Request, res: Response) => {
  const school = await schoolService.findSchoolById(req.params.id);
  res.json(successResponse(school));
};

export const updateSchool = async (req: Request, res: Response) => {
  const { status, ...rest } = req.body ?? {};
  const updated =
    status && Object.keys(rest).length === 0
      ? await schoolService.updateSchoolStatus(req.params.id, status)
      : await schoolService.updateSchool(req.params.id, req.body);

  res.json(successResponse(updated));
};

export const getSchoolOverview = async (req: Request, res: Response) => {
  const overview = await schoolService.getSchoolOverview(req.params.id);
  res.json(successResponse(overview));
};

export const getSchoolBilling = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined
  };
  const billing = await schoolService.getSchoolBilling(req.params.id, pagination, filters);
  res.json(successResponse(billing));
};

export const listSchoolUsers = async (req: Request, res: Response) => {
  const school = await schoolService.findSchoolById(req.params.id);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    role: req.query.role as string | undefined,
    q: req.query.q as string | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await userService.findAllUsers(school.id, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const listSchoolAuditLogs = async (req: Request, res: Response) => {
  const school = await schoolService.findSchoolById(req.params.id);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    school_id: school.id,
    actor_id: req.query.actor_id as string | undefined,
    actor_type: req.query.actor_type as string | undefined,
    action: req.query.action as string | undefined,
    resource_type: req.query.resource_type as string | undefined,
    severity: req.query.severity as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined
  };

  const result = await auditService.findAuditLogs(pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const deleteSchool = async (req: Request, res: Response) => {
  const school = await schoolService.softDeleteSchool(req.params.id);
  res.json(successResponse(school));
};
