CREATE TABLE "demo_requests" (
    "id" CHAR(36) NOT NULL,
    "school_name" VARCHAR(255) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "phone_country_code" VARCHAR(8) NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "job_title" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "email" VARCHAR(255) NOT NULL,
    "student_count" INTEGER NOT NULL,
    "teacher_count" INTEGER NOT NULL,
    "staff_count" INTEGER NOT NULL,
    "has_current_system" BOOLEAN NOT NULL DEFAULT false,
    "current_software" VARCHAR(255),
    "modules" JSONB NOT NULL,
    "preferred_date" VARCHAR(20),
    "preferred_time" VARCHAR(30),
    "additional_details" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "demo_requests_status_idx" ON "demo_requests"("status");
CREATE INDEX "demo_requests_created_at_idx" ON "demo_requests"("created_at");
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");
