ALTER TABLE "fee_structures" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "fee_structures_is_active_idx" ON "fee_structures"("is_active");
