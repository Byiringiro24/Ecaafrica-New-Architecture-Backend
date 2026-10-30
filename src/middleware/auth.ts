import type { NextFunction, Request, Response } from "express";
import { prisma } from "../database/prisma";
import { errorResponse } from "../helpers/response";
import type { AuthUser } from "../types/auth";
import { verifyAccessToken } from "../utils/jwt";
import { AuditActorType } from "../constants/enums";
import { logAction } from "../services/audit.service";

const SCHOOL_SUSPENDED_MESSAGE =
  "School suspended. Check your email and contact the system administrator.";

const getBearerToken = (req: Request) => {
  const header = req.headers.authorization;
  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return token;
};

const attachUser = (req: Request, user: AuthUser) => {
  req.user = user;
};

const attachMutationAudit = (req: Request, res: Response) => {
  const user = req.user;
  if (!user || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return;

  res.once("finish", () => {
    void logAction(user.id, AuditActorType.SCHOOL_USER, `${req.method.toLowerCase()}_request`, "api_request", null, {
      schoolId: user.school_id,
      resourceName: req.originalUrl.slice(0, 255),
      newValues: {
        status_code: res.statusCode,
        active_role: req.header("x-active-role") ?? null,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent")?.slice(0, 500),
    });
  });
};

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json(errorResponse("unauthorized", "Missing access token"));
    return;
  }

  try {
    const decoded = verifyAccessToken(token, { scope: "school" });
    if (decoded.token_type && decoded.token_type !== "access") {
      res.status(401).json(errorResponse("unauthorized", "Invalid token type"));
      return;
    }

    if (decoded.auth_type && decoded.auth_type !== "school") {
      res.status(403).json(errorResponse("forbidden", "School access required"));
      return;
    }

    if (decoded.school_id) {
      const schoolId = typeof decoded.school_id === "bigint" ? decoded.school_id : BigInt(decoded.school_id);
      const school = await prisma.schools.findFirst({
        where: {
          id: schoolId,
          deleted_at: null
        },
        select: {
          status: true
        }
      });

      if (school?.status === "suspended") {
        res.status(403).json(errorResponse("forbidden", SCHOOL_SUSPENDED_MESSAGE));
        return;
      }
    }

    attachUser(req, decoded);
    attachMutationAudit(req, res);
    next();
  } catch (err) {
    next(err);
  }
};

export const verifyTokenOrPlatform = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json(errorResponse("unauthorized", "Missing access token"));
    return;
  }

  try {
    const decoded = verifyAccessToken(token, { scope: "school" });
    if (decoded.token_type && decoded.token_type !== "access") {
      res.status(401).json(errorResponse("unauthorized", "Invalid token type"));
      return;
    }

    if (decoded.auth_type && decoded.auth_type !== "school") {
      throw new Error("school token required");
    }

    if (decoded.school_id) {
      const schoolId = typeof decoded.school_id === "bigint" ? decoded.school_id : BigInt(decoded.school_id);
      const school = await prisma.schools.findFirst({
        where: {
          id: schoolId,
          deleted_at: null
        },
        select: {
          status: true
        }
      });

      if (school?.status === "suspended") {
        res.status(403).json(errorResponse("forbidden", SCHOOL_SUSPENDED_MESSAGE));
        return;
      }
    }

    attachUser(req, decoded);
    attachMutationAudit(req, res);
    next();
    return;
  } catch {
    // fall back to platform token validation
  }

  try {
    const decoded = verifyAccessToken(token, { scope: "platform" });
    if (decoded.token_type && decoded.token_type !== "access") {
      res.status(401).json(errorResponse("unauthorized", "Invalid token type"));
      return;
    }

    if (decoded.auth_type && decoded.auth_type !== "platform") {
      res.status(403).json(errorResponse("forbidden", "Platform access required"));
      return;
    }

    attachUser(req, decoded);
    next();
  } catch (err) {
    next(err);
  }
};

export const verifyPlatformToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json(errorResponse("unauthorized", "Missing access token"));
    return;
  }

  try {
    const decoded = verifyAccessToken(token, { scope: "platform" });
    if (decoded.token_type && decoded.token_type !== "access") {
      res.status(401).json(errorResponse("unauthorized", "Invalid token type"));
      return;
    }

    if (decoded.auth_type && decoded.auth_type !== "platform") {
      res.status(403).json(errorResponse("forbidden", "Platform access required"));
      return;
    }

    attachUser(req, decoded);
    next();
  } catch (err) {
    next(err);
  }
};
