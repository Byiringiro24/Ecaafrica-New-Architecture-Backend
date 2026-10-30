ALTER TABLE "dining_sessions" ADD COLUMN IF NOT EXISTS "class_id" BIGINT;

CREATE INDEX IF NOT EXISTS "dining_sessions_class_id_idx" ON "dining_sessions"("class_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dining_sessions_class_id_fkey') THEN
    ALTER TABLE "dining_sessions"
      ADD CONSTRAINT "dining_sessions_class_id_fkey"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
