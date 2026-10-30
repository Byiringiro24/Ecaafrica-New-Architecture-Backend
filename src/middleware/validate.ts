import type { RequestHandler } from "express";
import { z, ZodTypeAny } from "zod";
import { errorResponse } from "../helpers/response";

export type RequestSchema = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  headers?: ZodTypeAny;
};

const isZodSchema = (value: unknown): value is ZodTypeAny =>
  Boolean(value) && typeof (value as ZodTypeAny).safeParse === "function";

const buildRequestSchema = (schema: ZodTypeAny | RequestSchema) => {
  if (isZodSchema(schema)) {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const hasRequestKeys = ["body", "params", "query", "headers"].some(
        (key) => key in shape
      );

      if (hasRequestKeys) {
        return schema;
      }
    }

    return z.object({ body: schema });
  }

  return z.object({
    body: schema.body ?? z.any(),
    params: schema.params ?? z.any(),
    query: schema.query ?? z.any(),
    headers: schema.headers ?? z.any()
  });
};

export const validate = (schema: ZodTypeAny | RequestSchema): RequestHandler =>
  (req, res, next) => {
    const requestSchema = buildRequestSchema(schema);
    const result = requestSchema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers
    });

    if (!result.success) {
      const details = result.error.errors.map((issue) => issue.message);
      res
        .status(400)
        .json(errorResponse("validation_error", "Validation failed", details));
      return;
    }

    if (result.data.body !== undefined) {
      req.body = result.data.body;
    }

    if (result.data.params !== undefined) {
      req.params = result.data.params;
    }

    if (result.data.query !== undefined) {
      req.query = result.data.query;
    }

    next();
  };
