-- Create parent_app_otps table for OTP storage
CREATE TABLE "parent_app_otps" (
    "id" BIGSERIAL NOT NULL,
    "parent_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_app_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "parent_app_otps_phone_idx" ON "parent_app_otps"("phone");
CREATE INDEX "parent_app_otps_parent_id_idx" ON "parent_app_otps"("parent_id");
CREATE INDEX "parent_app_otps_expires_at_idx" ON "parent_app_otps"("expires_at");

-- Create parent_app_sessions table for 2-week sessions
CREATE TABLE "parent_app_sessions" (
    "id" BIGSERIAL NOT NULL,
    "parent_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_app_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parent_app_sessions_token_hash_key" ON "parent_app_sessions"("token_hash");
CREATE INDEX "parent_app_sessions_parent_id_idx" ON "parent_app_sessions"("parent_id");
CREATE INDEX "parent_app_sessions_expires_at_idx" ON "parent_app_sessions"("expires_at");
CREATE INDEX "parent_app_sessions_revoked_at_idx" ON "parent_app_sessions"("revoked_at");

-- Create parent_app_notifications table for in-app notifications
CREATE TABLE "parent_app_notifications" (
    "id" BIGSERIAL NOT NULL,
    "parent_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_app_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "parent_app_notifications_parent_id_idx" ON "parent_app_notifications"("parent_id");
CREATE INDEX "parent_app_notifications_school_id_idx" ON "parent_app_notifications"("school_id");
CREATE INDEX "parent_app_notifications_is_read_idx" ON "parent_app_notifications"("is_read");
CREATE INDEX "parent_app_notifications_created_at_idx" ON "parent_app_notifications"("created_at");
