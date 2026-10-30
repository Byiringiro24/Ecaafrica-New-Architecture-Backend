-- Add a generated column + unique index to gate_logs so concurrent SSE and
-- pull-log workers never insert duplicate scans for the same student/device
-- within the same 30-second bucket.
--
-- dedup_bucket = floor(unix_epoch_seconds / 30)
-- Two scans from the same device for the same student and direction that land
-- within 30 seconds of each other → same bucket → ON CONFLICT DO NOTHING.
--
-- This is safe to deploy on a live table; GENERATED ALWAYS ... STORED adds the
-- column and backfills it in one DDL statement with no application changes.

ALTER TABLE gate_logs
  ADD COLUMN IF NOT EXISTS dedup_bucket BIGINT
    GENERATED ALWAYS AS (floor(extract(epoch from scanned_at) / 30)) STORED;

-- Partial unique index — only enforce dedup when device_id and student_id are set
-- (visitor/manual logs without those fields are excluded).
CREATE UNIQUE INDEX IF NOT EXISTS gate_logs_dedup_key
  ON gate_logs (device_id, student_id, event_type, dedup_bucket)
  WHERE device_id IS NOT NULL AND student_id IS NOT NULL;
