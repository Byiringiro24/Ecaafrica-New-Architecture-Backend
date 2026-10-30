import { z } from "zod";

const email = z.string().trim().email().max(255);

export const createDemoRequestSchema = z.object({
  schoolName: z.string().trim().min(1).max(255),
  country: z.string().trim().min(1).max(100),
  countryCode: z.string().trim().length(2).transform((v) => v.toUpperCase()),
  phoneCountryCode: z.string().trim().regex(/^\+\d{1,7}$/),
  contactName: z.string().trim().min(1).max(255),
  jobTitle: z.string().trim().min(1).max(255),
  phone: z.string().trim().min(7).max(30),
  whatsapp: z.boolean().default(false),
  email,
  studentCount: z.number().int().positive(),
  teacherCount: z.number().int().positive(),
  staffCount: z.number().int().nonnegative(),
  hasCurrentSystem: z.enum(["yes", "no"]),
  currentSoftware: z.string().trim().max(255).optional().default(""),
  modules: z.array(z.string().max(50)).max(20).default([]),
  preferredDate: z.string().max(20).optional().default(""),
  preferredTime: z.string().max(30).optional().default(""),
  additionalDetails: z.string().max(500).optional().default(""),
  consent: z.literal(true)
});

export const updateDemoRequestSchema = z.object({
  status: z.enum(["Pending", "Contacted", "Scheduled", "Completed"])
});
