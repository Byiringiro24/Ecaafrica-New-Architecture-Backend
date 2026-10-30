-- Keep the legacy boarding_officer value available for existing application
-- code and records while director_of_discipline is the preferred role.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'boarding_officer';
