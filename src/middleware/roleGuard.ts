import type { NextFunction, Request, Response } from "express";
import { errorResponse } from "../helpers/response";

const resolveSchoolId = (req: Request) => {
  const paramSchoolId = req.params.schoolId || req.params.school_id;
  if (paramSchoolId) {
    return paramSchoolId;
  }

  if (typeof req.body?.school_id === "string" || typeof req.body?.school_id === "number") {
    return req.body.school_id;
  }

  if (typeof req.query?.school_id === "string") {
    return req.query.school_id;
  }

  return undefined;
};

// Helper: get all effective roles for the request user.
// Primary role comes from users.role (in JWT).
// Secondary roles come from user_roles join table (also in JWT as secondary_roles[]).
const getEffectiveRoles = (req: Request): string[] => {
  const primary = req.user?.role;
  const secondary: string[] = Array.isArray(req.user?.secondary_roles)
    ? (req.user.secondary_roles as string[])
    : [];
  return primary ? [primary, ...secondary] : secondary;
};

export const hasEffectiveRole = (req: Request, ...roles: string[]) =>
  getEffectiveRoles(req).some((role) => roles.includes(role));

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const effective = getEffectiveRoles(req);
    if (!effective.length) {
      res.status(401).json(errorResponse("unauthorized", "Missing user context"));
      return;
    }

    if (!roles.some((r) => effective.includes(r))) {
      res.status(403).json(errorResponse("forbidden", "Insufficient role"));
      return;
    }

    next();
  };

/**
 * Middleware to ensure only system administrators can access hardware management endpoints
 * System admin = platform owner who manages hardware infrastructure
 */
export const requireSystemAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userRole = req.user?.role;
  
  if (!userRole) {
    res.status(401).json(errorResponse("unauthorized", "Missing user context"));
    return;
  }
  
  if (userRole !== 'system_admin') {
    res.status(403).json(errorResponse(
      "forbidden", 
      "Only system administrators can manage hardware. Contact platform administrator."
    ));
    return;
  }
  
  next();
};

/**
 * Middleware to ensure only school administrators can access school operations endpoints
 * School admin = school staff who manages daily school operations
 */
export const requireSchoolAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userRole = req.user?.role;
  
  if (!userRole) {
    res.status(401).json(errorResponse("unauthorized", "Missing user context"));
    return;
  }
  
  if (userRole !== 'school_admin') {
    res.status(403).json(errorResponse(
      "forbidden", 
      "Only school administrators can manage school operations."
    ));
    return;
  }
  
  next();
};

export const requireSchoolAccess = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const schoolId = resolveSchoolId(req);
  const userSchoolId = req.user?.school_id;

  if (req.user?.role === "platform_admin") {
    next();
    return;
  }

  if (!userSchoolId) {
    res.status(403).json(errorResponse("forbidden", "Missing school context"));
    return;
  }

  if (!schoolId) {
    next();
    return;
  }

  if (String(schoolId) !== String(userSchoolId)) {
    res.status(403).json(errorResponse("forbidden", "School access denied"));
    return;
  }

  next();
};

/** Gate keepers may view device attendance, but cannot modify attendance records. */
export const rejectGateKeeperAttendanceWrite = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role === "gate_keeper") {
    res.status(403).json(errorResponse("forbidden", "Gate keepers can only view device attendance"));
    return;
  }

  next();
};

/** Only DOD and school admin can approve/reject leave requests */
export const requireLeaveApprovalRole = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const effective = getEffectiveRoles(req);
  if (!effective.length) {
    res.status(401).json(errorResponse("unauthorized", "Missing user context"));
    return;
  }
  if (!["school_admin", "director_of_discipline"].some(r => effective.includes(r))) {
    res.status(403).json(errorResponse("forbidden", "Only Director of Discipline or School Admin can approve leave"));
    return;
  }
  next();
};

/** Boarding operational roles: school_admin, director_of_discipline, patron, matron. */
export const requireBoardingRole = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const effective = getEffectiveRoles(req);
  if (!effective.length) {
    res.status(401).json(errorResponse("unauthorized", "Missing user context"));
    return;
  }
  const allowed = ["school_admin", "director_of_discipline", "patron", "matron"];
  if (!allowed.some(r => effective.includes(r))) {
    res.status(403).json(errorResponse("forbidden", "Boarding access required"));
    return;
  }
  next();
};

/** Gate keeper can only confirm exit — cannot approve leave */
export const requireGateKeeperOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const effective = getEffectiveRoles(req);
  if (!effective.length) {
    res.status(401).json(errorResponse("unauthorized", "Missing user context"));
    return;
  }
  const allowed = ["school_admin", "gate_keeper", "director_of_discipline"];
  if (!allowed.some(r => effective.includes(r))) {
    res.status(403).json(errorResponse("forbidden", "Gate keeper or admin access required"));
    return;
  }
  next();
};

/** Director of Studies role guard — also allows teacher with secondary DOS role */
export const requireDirectorOfStudies = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const effective = getEffectiveRoles(req);
  if (!effective.length) {
    res.status(401).json(errorResponse("unauthorized", "Missing user context"));
    return;
  }
  if (!["school_admin", "director_of_studies"].some(r => effective.includes(r))) {
    res.status(403).json(errorResponse("forbidden", "Director of Studies access required"));
    return;
  }
  next();
};
