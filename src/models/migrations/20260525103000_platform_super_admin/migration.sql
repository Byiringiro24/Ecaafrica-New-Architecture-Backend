-- Seed platform super admin
INSERT INTO "platform_users" (
  "uuid",
  "name",
  "email",
  "password_hash",
  "role",
  "access_scope",
  "permissions",
  "status"
) VALUES (
  'c3b7e1d4-0f13-4a7d-9c6e-5d02b7d6a9f0',
  'System Super Admin',
  'admin@platform.test',
  '$argon2id$v=19$m=65536,t=3,p=4$W6F67UnQLOnto99Cle268g$JmFf4emz+0uvL57QbUZmu1+X80Us++vzCyAy+ta7yL4',
  'platform_admin',
  'all',
  NULL,
  'active'
)
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "password_hash" = EXCLUDED."password_hash",
  "role" = 'platform_admin',
  "access_scope" = 'all',
  "status" = 'active',
  "updated_at" = CURRENT_TIMESTAMP,
  "deleted_at" = NULL;
