-- Add dev_password to tablets.
-- This migration already exists in some deployed databases; keeping it in the
-- active migration directory prevents Prisma history divergence.
ALTER TABLE "tablets"
  ADD COLUMN IF NOT EXISTS "dev_password" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "dev_password_set_at" TIMESTAMPTZ(3);
