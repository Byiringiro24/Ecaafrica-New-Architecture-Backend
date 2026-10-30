-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "country" VARCHAR(100);

-- CreateIndex
CREATE INDEX "schools_country_idx" ON "schools"("country");
