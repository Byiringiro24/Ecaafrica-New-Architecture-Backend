const setDefault = (key: string, value: string) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
};

// Default DATABASE_URL for local development/tests. Override with environment
// variable when running in CI or when pointing to a different database.
// Local developer DB (your machine):
// postgresql://artic_user:Artic$2026@localhost:15432/ECAREAFRICA?schema=public&sslmode=disable
// Server DB (example):
// postgresql://postgres:2211@localhost:5432/ecareafrica?schema=public
setDefault(
  "DATABASE_URL",
  process.env.DATABASE_URL ||
    "postgresql://artic_user:Artic$2026@localhost:15432/ECAREAFRICA?schema=public&sslmode=disable",
);
setDefault("JWT_SECRET", "test-jwt-secret");
setDefault("JWT_REFRESH_SECRET", "test-jwt-refresh-secret");
setDefault("PLATFORM_JWT_SECRET", "test-platform-jwt-secret");
setDefault("PLATFORM_JWT_REFRESH_SECRET", "test-platform-jwt-refresh-secret");
setDefault("JWT_EXPIRES_IN", "1h");
setDefault("JWT_REFRESH_EXPIRES_IN", "7d");
setDefault("PORT", "3001");
setDefault("NODE_ENV", "test");
setDefault("CORS_ORIGIN", "*");
setDefault("S3_ENDPOINT", "https://s3.example.com");
setDefault("S3_REGION", "us-east-1");
setDefault("S3_BUCKET", "ecareafrica-test");
setDefault("S3_ACCESS_KEY_ID", "test-access-key");
setDefault("S3_SECRET_ACCESS_KEY", "test-secret-key");
setDefault("S3_PUBLIC_URL", "https://cdn.example.com");
setDefault("SMTP_HOST", "smtp.example.com");
setDefault("SMTP_PORT", "2525");
setDefault("SMTP_USER", "test-user");
setDefault("SMTP_PASS", "test-pass");
setDefault("SMTP_FROM", "noreply@ecareafrica.test");
