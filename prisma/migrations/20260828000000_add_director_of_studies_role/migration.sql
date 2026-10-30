-- Add director_of_studies to UserRole enum
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'director_of_studies'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'director_of_studies';
  END IF;
END $$;
