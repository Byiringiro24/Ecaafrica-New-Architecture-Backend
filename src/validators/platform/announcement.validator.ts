import { z } from "zod";
import {
  AnnouncementStatus,
  AnnouncementTargetScope,
  AnnouncementType
} from "@prisma/client";

const dateInput = z.union([z.string(), z.date()]).nullable().optional();

export const announcementIdParamSchema = z.object({
  id: z.string().min(1)
});

const createAnnouncementBodySchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  type: z.nativeEnum(AnnouncementType).optional(),
  target_scope: z.nativeEnum(AnnouncementTargetScope).optional(),
  target_values: z.unknown().nullable().optional(),
  status: z.nativeEnum(AnnouncementStatus).optional(),
  scheduled_at: dateInput,
  sent_at: dateInput,
  send_inapp: z.boolean().optional(),
  send_email: z.boolean().optional()
});

const updateAnnouncementBodySchema = createAnnouncementBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const listAnnouncementsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  status: z.nativeEnum(AnnouncementStatus).optional(),
  type: z.nativeEnum(AnnouncementType).optional(),
  target_scope: z.nativeEnum(AnnouncementTargetScope).optional()
});

const markAnnouncementReadBodySchema = z.object({
  school_id: z.union([z.string(), z.number()]),
  user_id: z.union([z.string(), z.number()]).nullable().optional()
});

export const createAnnouncementSchema = z.object({
  body: createAnnouncementBodySchema
});

export const updateAnnouncementSchema = z.object({
  params: announcementIdParamSchema,
  body: updateAnnouncementBodySchema
});

export const listAnnouncementsSchema = z.object({
  query: listAnnouncementsQuerySchema
});

export const markAnnouncementReadSchema = z.object({
  params: announcementIdParamSchema,
  body: markAnnouncementReadBodySchema
});
