-- Create the initial platform super admin if the email is not already registered.
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
  '94df3171-65a0-4bfc-a4e0-f18fb99e9110',
  'System Super Admin',
  'fabricembarush5@gmail.com',
  '$argon2id$v=19$m=65536,p=4,t=3$p+pV/yQK+2A4099bWsqJ8w$yPQ3N5JuSaTRsAufvMUccmYJwh7mvgW1LtW1KMUrExA',
  'platform_admin',
  'all',
  NULL,
  'active'
)
ON CONFLICT ("email") DO NOTHING;
