import type { Request, Response } from "express";
import { parsePagination } from "../helpers/pagination";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as userService from "../services/user.service";
import * as authService from "../services/auth.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) throw new AppError("forbidden", "Missing school context", 403);
  return schoolId;
};

// Roles DOD is allowed to create/manage — cannot touch school_admin or platform roles
const DOD_ALLOWED_ROLES = [
  "patron", "matron", "gate_keeper",
  "teacher", "staff", "director_of_studies", "finance_officer",
];

// Roles DOS is allowed to create/manage — academic staff only
const DOS_ALLOWED_ROLES = [
  "teacher", "staff",
];

const getActingRole = (req: Request) => {
  const effectiveRoles = [
    req.user?.role,
    ...(Array.isArray(req.user?.secondary_roles) ? req.user.secondary_roles : []),
  ].filter((role): role is string => Boolean(role));
  const requestedRole = String(req.header("x-active-role") ?? "").trim().toLowerCase();
  return requestedRole && effectiveRoles.includes(requestedRole)
    ? requestedRole
    : effectiveRoles[0];
};

const assertDodRolePermission = (req: Request, targetRole?: string, secondaryRoles?: string[]) => {
  const requestedRoles = new Set<string>();
  if (targetRole) requestedRoles.add(String(targetRole).trim().toLowerCase());
  if (Array.isArray(secondaryRoles)) {
    for (const role of secondaryRoles) {
      if (role) requestedRoles.add(String(role).trim().toLowerCase());
    }
  }

  for (const requestedRole of requestedRoles) {
    if (getActingRole(req) === "director_of_discipline" && !DOD_ALLOWED_ROLES.includes(requestedRole)) {
      throw new AppError(
        "forbidden",
        `Director of Discipline can only manage these roles: ${DOD_ALLOWED_ROLES.join(", ")}`,
        403
      );
    }
    if (getActingRole(req) === "director_of_studies" && !DOS_ALLOWED_ROLES.includes(requestedRole)) {
      throw new AppError(
        "forbidden",
        `Director of Studies can only create these roles: ${DOS_ALLOWED_ROLES.join(", ")}`,
        403
      );
    }
  }
};

export const createUser = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  assertDodRolePermission(req, req.body.role, req.body.roles);
  const user = await userService.createUser(schoolId, req.body);
  res.status(201).json(successResponse(user));
};

export const listUsers = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const pagination = parsePagination(req.query as Record<string, string>);
  const filters = {
    status: req.query.status as string | undefined,
    role: req.query.role as string | undefined,
    include_deleted: req.query.include_deleted as boolean | undefined
  };

  const result = await userService.findAllUsers(schoolId, pagination, filters);
  res.json(successResponse(result.data, result.meta));
};

export const getUser = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const user = await userService.findUserById(schoolId, req.params.id);
  res.json(successResponse(user));
};

export const updateUser = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  assertDodRolePermission(req, req.body.role, req.body.roles);
  const user = await userService.updateUser(schoolId, req.params.id, req.body);
  res.json(successResponse(user));
};

export const resetStaffPassword = async (req: Request, res: Response) => {
  const result = await authService.sendStaffPasswordReset(
    resolveSchoolId(req),
    req.params.id,
    req.user!.id,
  );
  res.json(successResponse({
    message: "Password reset link sent to the staff member.",
    ...result,
  }));
};

export const deleteUser = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const user = await userService.softDeleteUser(schoolId, req.params.id);
  res.json(successResponse(user));
};

export const assignRole = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const { role_id } = req.body;
  const user = await userService.assignRole(schoolId, req.params.id, role_id);
  res.json(successResponse(user));
};

export const removeRole = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const user = await userService.removeRole(
    schoolId,
    req.params.id,
    req.params.roleId
  );
  res.json(successResponse(user));
};
