import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  PLATFORM_JWT_SECRET: z.string().min(1),
  PLATFORM_JWT_REFRESH_SECRET: z.string().min(1),
  APP_JWT_SECRET: z.string().min(1).optional(),
  APP_JWT_REFRESH_SECRET: z.string().min(1).optional(),
  JWT_EXPIRES_IN: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(["development", "test", "production"]),
  // IANA timezone used by server-side date and calendar operations.
  TZ: z.string().min(1).default("Africa/Kampala"),
  TRUST_PROXY: z.coerce.boolean().optional(),
  CORS_ORIGIN: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_PUBLIC_URL: z.string().min(1),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  APP_BASE_URL: z.string().min(1).optional(),
  REST_COUNTRIES_KEY: z.string().min(1).optional(),
  SMS_UGANDA_API_URL: z.string().min(1).optional(),
  SMS_UGANDA_USER: z.string().min(1).optional(),
  SMS_UGANDA_PASSWORD: z.string().min(1).optional(),
  SMS_UGANDA_SENDER: z.string().min(1).optional()
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

// Apply the configured timezone before the rest of the application creates
// dates. This prevents server-side calendar operations from depending on the
// host's or developer's local timezone.
process.env.TZ = env.TZ;
