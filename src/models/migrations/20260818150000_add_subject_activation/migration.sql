-- Existing subjects remain usable; only subjects created after this migration
-- default to inactive until a school administrator activates them.
ALTER TABLE "subjects" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "subjects" ALTER COLUMN "is_active" SET DEFAULT FALSE;
CREATE INDEX "subjects_is_active_idx" ON "subjects"("is_active");
