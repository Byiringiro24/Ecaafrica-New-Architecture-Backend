import { Gender, UserRole } from "@prisma/client";
import { z } from "zod";

const id = z.union([z.string().min(1), z.number()]);

export const createBoardingSupervisorSchema = z.object({
  body: z
    .object({
      name: z.string().min(2),
      email: z.string().email().nullable().optional(),
      phone: z.string().min(6).nullable().optional(),
      password: z.string().min(8),
      role: z.enum([UserRole.patron, UserRole.matron]),
      gender: z.nativeEnum(Gender).optional(),
      dormitory_ids: z.array(id).optional(),
    })
    .refine((data) => data.email || data.phone, {
      path: ["email"],
      message: "Email or phone is required",
    }),
});

export const replaceSupervisorDormitoriesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ dormitory_ids: z.array(id) }),
});
