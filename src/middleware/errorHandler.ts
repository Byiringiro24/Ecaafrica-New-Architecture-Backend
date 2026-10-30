import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { errorResponse } from "../helpers/response";
import { logger } from "../utils/logger";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details: string[];

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details: string[] = []
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

type UniqueConstraintTarget = string[];

const getUniqueConstraintTarget = (
  error: Prisma.PrismaClientKnownRequestError
): UniqueConstraintTarget => {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.filter((field): field is string => typeof field === "string");
  }
  if (typeof target === "string") {
    return [target];
  }
  return [];
};

const hasConstraintFields = (target: UniqueConstraintTarget, fields: string[]) =>
  target.length === fields.length && fields.every((field) => target.includes(field));

const getUniqueConstraintMessage = (target: UniqueConstraintTarget) => {
  if (hasConstraintFields(target, ["school_id", "email"])) {
    return "A user with this email already exists in this school";
  }

  if (hasConstraintFields(target, ["session_id", "student_id"])) {
    return "An attendance record already exists for this student in this session";
  }

  if (hasConstraintFields(target, ["school_id", "staff_id_number"])) {
    return "A staff ID with this number already exists in this school";
  }

  return "A record with these details already exists";
};

export const getErrorPayload = (err: unknown) => {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details
    };
  }

  if (err instanceof TokenExpiredError) {
    return {
      statusCode: 401,
      code: "token_expired",
      message: "Token expired",
      details: []
    };
  }

  if (err instanceof JsonWebTokenError) {
    return {
      statusCode: 401,
      code: "invalid_token",
      message: "Invalid token",
      details: []
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return {
      statusCode: 409,
      code: "conflict",
      message: getUniqueConstraintMessage(getUniqueConstraintTarget(err)),
      details: []
    };
  }

  if (err instanceof Error) {
    return {
      statusCode: 500,
      code: "internal_error",
      message: err.message,
      details: []
    };
  }

  return {
    statusCode: 500,
    code: "internal_error",
    message: "Unexpected error",
    details: []
  };
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  logger.error({ err }, "Request failed");

  const payload = getErrorPayload(err);
  res
    .status(payload.statusCode)
    .json(errorResponse(payload.code, payload.message, payload.details));
};
