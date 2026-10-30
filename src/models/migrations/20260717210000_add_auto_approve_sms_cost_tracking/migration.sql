-- Add per-session attendance approval behavior.
ALTER TABLE "device_sessions"
ADD COLUMN "auto_approve" BOOLEAN NOT NULL DEFAULT true;

-- Store the current provider rate and currency.
ALTER TABLE "sms_providers"
ADD COLUMN "unit_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'RWF';

-- Snapshot the provider rate on each SMS for historical spend reporting.
ALTER TABLE "notification_logs"
ADD COLUMN "sms_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "sms_currency" CHAR(3) NOT NULL DEFAULT 'RWF';
