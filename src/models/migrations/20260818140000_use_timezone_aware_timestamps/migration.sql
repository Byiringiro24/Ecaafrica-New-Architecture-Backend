-- Preserve existing values as Africa/Kigali local time while converting
-- timestamp columns to absolute, timezone-aware instants.
DO $$
DECLARE
  column_record RECORD;
BEGIN
  FOR column_record IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'timestamp without time zone'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE TIMESTAMPTZ(3) USING %I AT TIME ZONE %L',
      column_record.table_schema,
      column_record.table_name,
      column_record.column_name,
      column_record.column_name,
      'Africa/Kigali'
    );
  END LOOP;
END $$;
