-- AlterTable
ALTER TABLE "staff_profiles"
  ADD COLUMN "date_of_birth" DATE,
  ADD COLUMN "national_id" VARCHAR(30),
  ADD COLUMN "address" TEXT,
  ADD COLUMN "emergency_contact" VARCHAR(100),
  ADD COLUMN "qualifications" VARCHAR(255),
  ADD COLUMN "experience" VARCHAR(100),
  ADD COLUMN "timetable_access" VARCHAR(50),
  ADD COLUMN "basic_salary" DECIMAL(12,2);
