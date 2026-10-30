CREATE TYPE "SupportTicketAudience" AS ENUM ('school_admin', 'platform_admin');
ALTER TABLE "support_tickets" ALTER COLUMN "audience" DROP DEFAULT;
ALTER TABLE "support_tickets" ALTER COLUMN "audience" TYPE "SupportTicketAudience" USING "audience"::"SupportTicketAudience";
ALTER TABLE "support_tickets" ALTER COLUMN "audience" SET DEFAULT 'platform_admin';
