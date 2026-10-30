import { VisitorType } from "@prisma/client";
import { z } from "zod";

export const visitorIdParamSchema = z.object({
  id: z.string().min(1)
});

const createVisitorBodySchema = z.object({
  full_name: z.string().min(1).max(255),
  phone: z.string().trim().min(1, "Phone number is required").max(20),
  email: z.string().email().max(255).optional(),
  national_id: z.string().max(30).optional(),
  organization: z.string().max(255).optional(),
  visitor_type: z.nativeEnum(VisitorType).optional()
});

const updateVisitorBodySchema = createVisitorBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listVisitorsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  visitor_type: z.nativeEnum(VisitorType).optional()
});

export const createVisitorSchema = z.object({
  body: createVisitorBodySchema
});

export const updateVisitorSchema = z.object({
  params: visitorIdParamSchema,
  body: updateVisitorBodySchema
});

export const listVisitorsSchema = z.object({
  query: listVisitorsQuerySchema
});
