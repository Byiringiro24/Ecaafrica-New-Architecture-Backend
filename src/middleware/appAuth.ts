import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../configs/env";
import { errorResponse } from "../helpers/response";

const getSecret = () => env.APP_JWT_SECRET ?? env.JWT_SECRET;

const getBearerToken = (req: Request) => {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") return undefined;
  return token;
};

export const verifyAppToken = (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json(errorResponse("unauthorized", "Missing access token"));
    return;
  }

  try {
    const decoded = jwt.verify(token, getSecret()) as Record<string, unknown>;
    if (decoded.token_type !== "access") {
      res.status(401).json(errorResponse("unauthorized", "Invalid token type"));
      return;
    }
    if (decoded.auth_type !== "app") {
      res.status(403).json(errorResponse("forbidden", "App access required"));
      return;
    }

    req.appParent = {
      id: typeof decoded.id === "string" ? decoded.id : String(decoded.id),
      school_id: typeof decoded.school_id === "string" ? decoded.school_id : String(decoded.school_id),
      role: "parent",
      phone: decoded.phone as string
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json(errorResponse("token_expired", "Access token expired"));
      return;
    }
    res.status(401).json(errorResponse("unauthorized", "Invalid access token"));
  }
};
