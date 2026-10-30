import { z } from "zod";
import { BiometricType } from "@prisma/client";

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}, z.boolean().optional());

const idInput = z.union([z.string(), z.number()]);

export const biometricIdParamSchema = z.object({
  id: z.string().min(1)
});

const baseBiometricBodySchema = z.object({
  student_id: idInput,
  type: z.nativeEnum(BiometricType),
  template_hash: z.string().optional(),
  card_uid: z.string().optional(),
  enrolled_by: idInput.optional(),
  is_active: z.boolean().optional()
});

const createBiometricBodySchema = baseBiometricBodySchema.refine(
  (data) => {
    if (data.type === BiometricType.face || data.type === BiometricType.fingerprint) {
      return Boolean(data.template_hash);
    }

    if (data.type === BiometricType.card_nfc || data.type === BiometricType.card_qr) {
      return Boolean(data.card_uid);
    }

    return true;
  },
  {
    message: "Template hash or card UID is required for the selected biometric type"
  }
);

const updateBiometricBodySchema = baseBiometricBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listBiometricQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  student_id: z.string().optional(),
  type: z.nativeEnum(BiometricType).optional(),
  is_active: booleanQuery
});

export const createBiometricSchema = z.object({
  body: createBiometricBodySchema
});

export const updateBiometricSchema = z.object({
  params: biometricIdParamSchema,
  body: updateBiometricBodySchema
});

export const listBiometricSchema = z.object({
  query: listBiometricQuerySchema
});
