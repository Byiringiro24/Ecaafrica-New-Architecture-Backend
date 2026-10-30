import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as roleService from "../services/role.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

const DOD_ALLOWED_ROLES = [
  "patron", "matron", "gate_keeper",
  "teacher", "staff", "director_of_studies", "finance_officer"
];

const DOS_ALLOWED_ROLES = [
  "teacher", "staff"
];

const assertRolePermission = (req: Request, targetRole?: string) => {
  const normalizedRole = targetRole?.trim().toLowerCase();
  if (!normalizedRole) return;

  if (req.user?.role === "director_of_discipline" && !DOD_ALLOWED_ROLES.includes(normalizedRole)) {
    throw new AppError(
      "forbidden",
      `Director of Discipline can only manage these roles: ${DOD_ALLOWED_ROLES.join(", ")}`,
      403
    );
  }

  if (req.user?.role === "director_of_studies" && !DOS_ALLOWED_ROLES.includes(normalizedRole)) {
    throw new AppError(
      "forbidden",
      `Director of Studies can only create these roles: ${DOS_ALLOWED_ROLES.join(", ")}`,
      403
    );
  }
};

export const createRole = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  assertRolePermission(req, req.body.slug);
  const role = await roleService.createRole(schoolId, req.body);
  res.status(201).json(successResponse(role));
};

export const listRoles = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await roleService.findAllRoles(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getRole = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const role = await roleService.findRoleById(schoolId, req.params.id);
  res.json(successResponse(role));
};

export const updateRole = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  assertRolePermission(req, req.body.slug);
  const role = await roleService.updateRole(schoolId, req.params.id, req.body);
  res.json(successResponse(role));
};

export const deleteRole = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const role = await roleService.softDeleteRole(schoolId, req.params.id);
  res.json(successResponse(role));
};
