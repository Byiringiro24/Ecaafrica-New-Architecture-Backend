#!/bin/bash
# ============================================================
# EcaAfrica — TESTING / STAGING Deployment Script
#
# Server  : root@169.58.124.150
# Shared backend path : /var/www/testing/backend
# Shared frontend path: /var/www/testing/frontend
#
# This one backend serves BOTH environments:
#   staging.ecareafrica.net  → port 5600  (PM2: ecare-staging-backend)
#   testing.ecareafrica.net  → port 5501  (PM2: ecare-testing-backend)
#   testing-api.ecareafrica.net → port 5501 (nginx → 5501)
#
# Run FROM the server:
#   ssh root@169.58.124.150
#   curl -sL https://raw.githubusercontent.com/Byiringiro24/Ecaafrica-New-Architecture-Backend/main/deployment/linux/deploy-testing.sh | bash
# ============================================================

set -e

BACKEND_REPO="https://github.com/Byiringiro24/Ecaafrica-New-Architecture-Backend.git"
FRONTEND_REPO="https://github.com/Byiringiro24/Ecaafrica-New-Architecture-Frontend.git"
BACKEND_BRANCH="main"
FRONTEND_BRANCH="main"
BACKEND_DIR="/var/www/testing/backend"
FRONTEND_DIR="/var/www/testing/frontend"

# Testing runs on 5501 / staging runs on 5600
TESTING_PORT=5501
STAGING_PORT=5600
FRONTEND_PORT=4174

PM2_TESTING_BACKEND="ecare-testing-backend"
PM2_STAGING_BACKEND="ecare-staging-backend"
PM2_FRONTEND="ecare-testing-frontend"

# ── Force HTTPS remotes (no SSH keys on server) ───────────────
if [ -d "$BACKEND_DIR/.git" ]; then
  git -C "$BACKEND_DIR" remote set-url origin "$BACKEND_REPO" 2>/dev/null || true
fi
if [ -d "$FRONTEND_DIR/.git" ]; then
  git -C "$FRONTEND_DIR" remote set-url origin "$FRONTEND_REPO" 2>/dev/null || true
fi

echo "============================================"
echo "  EcaAfrica TESTING + STAGING Deployment"
echo "  Backend dir : $BACKEND_DIR"
echo "  Frontend dir: $FRONTEND_DIR"
echo "  Branch      : $BACKEND_BRANCH"
echo "  Testing port: $TESTING_PORT"
echo "  Staging port: $STAGING_PORT"
echo "============================================"

# ── 1. Stop PM2 processes (testing + staging, NOT production) ─
echo ""
echo "[1/10] Stopping testing/staging PM2 processes..."
pm2 stop  "$PM2_TESTING_BACKEND" 2>/dev/null || true
pm2 stop  "$PM2_STAGING_BACKEND" 2>/dev/null || true
pm2 stop  "$PM2_FRONTEND"        2>/dev/null || true
pm2 delete "$PM2_TESTING_BACKEND" 2>/dev/null || true
pm2 delete "$PM2_STAGING_BACKEND" 2>/dev/null || true
pm2 delete "$PM2_FRONTEND"        2>/dev/null || true
fuser -k ${TESTING_PORT}/tcp  2>/dev/null || true
fuser -k ${STAGING_PORT}/tcp  2>/dev/null || true
fuser -k ${FRONTEND_PORT}/tcp 2>/dev/null || true
echo "✓ PM2 processes stopped, ports freed"

# ── 2. Pull / clone backend ───────────────────────────────────
echo ""
echo "[2/10] Pulling backend ($BACKEND_BRANCH) → $BACKEND_DIR..."
mkdir -p "$BACKEND_DIR"
if [ -d "$BACKEND_DIR/.git" ]; then
  cd "$BACKEND_DIR"
  git fetch origin
  git checkout "$BACKEND_BRANCH"
  git reset --hard "origin/$BACKEND_BRANCH"
else
  rm -rf "$BACKEND_DIR"
  git clone -b "$BACKEND_BRANCH" "$BACKEND_REPO" "$BACKEND_DIR"
  cd "$BACKEND_DIR"
fi
echo "✓ Backend pulled — $(git log --oneline -1)"

# ── 3. Merge backend .env (never overwrite existing keys) ─────
# Rules:
#   - If .env does not exist → write full defaults
#   - If key already exists in .env → leave it untouched (server admin value wins)
#   - If key is MISSING from .env → append it
#
# IMPORTANT: CORS_ORIGIN must include BOTH staging AND testing domains
# because staging and testing share the same backend process pool.
# Never set CORS_ORIGIN to only one domain here.
merge_env() {
  local key="$1" value="$2" file="$3"
  if [ ! -f "$file" ]; then
    echo "$key=$value" >> "$file"
  elif ! grep -qE "^${key}=" "$file"; then
    echo "$key=$value" >> "$file"
    echo "  + added missing key: $key"
  fi
}

echo ""
echo "[3/10] Merging backend .env (existing keys preserved)..."
ENV_FILE="$BACKEND_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  echo "  ✓ Existing .env found — only adding missing keys"
else
  echo "  ✓ No .env found — creating with defaults"
fi

# ── Core ──────────────────────────────────────────────────────
# DATABASE_URL: defaults to architecturetest — change on server if needed
merge_env "DATABASE_URL"               '"postgresql://postgres:2211@localhost:5432/architecturetest?schema=public"' "$ENV_FILE"
merge_env "JWT_SECRET"                 "1b1a90a340949c666a212b212de76a9c7e14d24a5cd9c6b1de32d517668501b1" "$ENV_FILE"
merge_env "JWT_REFRESH_SECRET"         "hk3BkIhG-cEMddfdK3FIGsAgRL_16mQWxKDgnaRvdRwzbWC9ICwhQO0Kashg-DQEWjCnKz3tpxaG-K9Y2gyHrg" "$ENV_FILE"
merge_env "PLATFORM_JWT_SECRET"        "Gqwfm4cF1q3S2uX5nvdRkUZRQU40ZmcGRCBs4H666mgez6mNaU5iS7Mhjo3wSvKssqV2Sa0B7sFOk49181MEEw" "$ENV_FILE"
merge_env "PLATFORM_JWT_REFRESH_SECRET" "CL3gr3UNYYqfdcs8zdzvbMWkLn3rFRQn_BbkxOfOgFy1" "$ENV_FILE"
merge_env "JWT_EXPIRES_IN"             "30m"  "$ENV_FILE"
merge_env "JWT_REFRESH_EXPIRES_IN"     "30d"  "$ENV_FILE"

# PORT: testing backend default is 5501.
# staging-backend is started separately with PORT=5600.
merge_env "PORT"             "$TESTING_PORT"  "$ENV_FILE"
merge_env "NODE_ENV"         "production"     "$ENV_FILE"
merge_env "TZ"               "Africa/Kampala" "$ENV_FILE"
merge_env "TRUST_PROXY"      "true"           "$ENV_FILE"

# CORS: MUST include BOTH staging AND testing — both share this .env
merge_env "CORS_ORIGIN" \
  "https://staging.ecareafrica.net,http://staging.ecareafrica.net,https://testing.ecareafrica.net,http://testing.ecareafrica.net,https://testing-api.ecareafrica.net,http://testing-api.ecareafrica.net" \
  "$ENV_FILE"

merge_env "RATE_LIMIT_ENABLED"   "false"   "$ENV_FILE"
merge_env "RATE_LIMIT_WINDOW_MS" "900000"  "$ENV_FILE"
merge_env "RATE_LIMIT_MAX"       "200"     "$ENV_FILE"

# ── Storage ───────────────────────────────────────────────────
merge_env "S3_ENDPOINT"       "https://abcd1234efgh.r2.cloudflarestorage.com" "$ENV_FILE"
merge_env "S3_REGION"         "auto"                                           "$ENV_FILE"
merge_env "S3_BUCKET"         "ecareafrica-storage"                            "$ENV_FILE"
merge_env "S3_ACCESS_KEY_ID"  "RboLlUqEo8Ojh9ALgoWC_yzWuVeZFoN2dlX4XKZ0eCZh7g" "$ENV_FILE"
merge_env "S3_SECRET_ACCESS_KEY" "RboLlUqEo8Ojh9ALgoWC_yzWuVeZFoN2dlX4XKZ0eCZh7g" "$ENV_FILE"
merge_env "S3_PUBLIC_URL"     "https://pub.r2.dev"                            "$ENV_FILE"

# ── Email ─────────────────────────────────────────────────────
merge_env "SMTP_HOST" "smtp.gmail.com"                   "$ENV_FILE"
merge_env "SMTP_PORT" "587"                              "$ENV_FILE"
merge_env "SMTP_USER" "netrackdevelopement@gmail.com"   "$ENV_FILE"
merge_env "SMTP_PASS" "elkrdmcpmksazazy"                 "$ENV_FILE"
merge_env "SMTP_FROM" "netrackdevelopement@gmail.com"   "$ENV_FILE"

# ── Services ──────────────────────────────────────────────────
merge_env "REDIS_URL"           "redis://localhost:6379"             "$ENV_FILE"
merge_env "SMS_UGANDA_API_URL"  "http://text.emediauganda.com/api.php" "$ENV_FILE"
merge_env "SMS_UGANDA_USER"     "your_username"                      "$ENV_FILE"
merge_env "SMS_UGANDA_PASSWORD" "your_password"                      "$ENV_FILE"
merge_env "SMS_UGANDA_SENDER"   "EducationCare"                      "$ENV_FILE"
merge_env "APP_BASE_URL"        "https://staging.ecareafrica.net"    "$ENV_FILE"

# ── WireGuard ─────────────────────────────────────────────────
merge_env "WG_CONF_PATH"     "/etc/wireguard/wg0.conf"       "$ENV_FILE"
merge_env "WG_PUBKEY_PATH"   "/etc/wireguard/server_public.key" "$ENV_FILE"
merge_env "WG_INTERFACE"     "wg0"                             "$ENV_FILE"
merge_env "VPN_SUBNET"       "10.0"                            "$ENV_FILE"
merge_env "VPN_CIDR"         "16"                              "$ENV_FILE"
merge_env "SERVER_VPN_IP"    "10.0.0.1"                        "$ENV_FILE"
merge_env "SERVER_PUBLIC_IP" "169.58.124.150"                  "$ENV_FILE"
merge_env "WG_PORT"          "51820"                           "$ENV_FILE"

# ── Pull-logs tuning ──────────────────────────────────────────
merge_env "PULL_CONCURRENCY"        "10"    "$ENV_FILE"
merge_env "PULL_LOGS_INTERVAL_MS"   "5000"  "$ENV_FILE"
merge_env "PULL_TIMEOUT_MS"         "20000" "$ENV_FILE"
merge_env "OFFLINE_FAIL_THRESHOLD"  "3"     "$ENV_FILE"
merge_env "SSE_CONNECT_CONCURRENCY" "10"    "$ENV_FILE"
merge_env "SSE_CONNECT_STAGGER_MS"  "200"   "$ENV_FILE"
merge_env "SSE_DEDUP_CACHE_SIZE"    "10000" "$ENV_FILE"

echo "✓ .env merge complete — existing values untouched"
echo "  Active DATABASE_URL : $(grep '^DATABASE_URL=' "$ENV_FILE" | head -1)"
echo "  Active CORS_ORIGIN  : $(grep '^CORS_ORIGIN='  "$ENV_FILE" | head -1)"
echo "  Active PORT         : $(grep '^PORT='         "$ENV_FILE" | head -1)"

# ── 4. Ensure DB exists (uses TCP to avoid peer auth) ─────────
echo ""
echo "[4/10] Ensuring database exists..."
DB_NAME=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed "s|.*5432/\([^?\"]*\).*|\1|")
DB_PASS=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed 's/.*:\([^:@]*\)@.*/\1/')
echo "  DB name: $DB_NAME"
PGPASSWORD="$DB_PASS" psql -U postgres -h 127.0.0.1 -tc \
  "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" \
  | grep -q 1 \
  || PGPASSWORD="$DB_PASS" psql -U postgres -h 127.0.0.1 \
       -c "CREATE DATABASE \"$DB_NAME\" OWNER postgres;"
echo "✓ Database $DB_NAME ready"

# ── 5. Backend: install + prisma + build ─────────────────────
echo ""
echo "[5/10] Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --production=false
echo "✓ Dependencies installed"

echo "  Running prisma generate + migrate deploy..."
npx prisma generate --schema src/models/schema.prisma
npx prisma migrate deploy --schema src/models/schema.prisma
echo "✓ Prisma ready (all migrations applied)"

# ── Safety: apply critical columns that may be missing if DB was ──
# cloned from an older dump (migration marked applied but column absent)
echo "  Applying safety column patches to $DB_NAME..."
PGPASSWORD="$DB_PASS" psql -U postgres -h 127.0.0.1 -d "$DB_NAME" -q << 'SQLEOF'
-- attendance_logs table (migration 20260705093000)
CREATE TABLE IF NOT EXISTS "attendance_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT,
  "log_id" TEXT,
  "user_id" TEXT,
  "student_id" TEXT,
  "student_device_id" TEXT,
  "student_name" TEXT,
  "class_name" TEXT,
  "section" TEXT,
  "device_id" TEXT,
  "authentication_method" TEXT,
  "direction" TEXT,
  "timestamp" TIMESTAMPTZ,
  "status" TEXT,
  "attendance_period" TEXT,
  "raw_data" JSONB,
  "sync_state" VARCHAR(20) NOT NULL DEFAULT 'synced',
  "is_flagged" BOOLEAN NOT NULL DEFAULT FALSE,
  "flag_reason" VARCHAR(255),
  "synced_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_logs_log_id_device_id_key"
  ON "attendance_logs" ("log_id", "device_id");
CREATE INDEX IF NOT EXISTS "attendance_logs_school_id_idx"
  ON "attendance_logs" ("school_id");
CREATE INDEX IF NOT EXISTS "attendance_logs_timestamp_idx"
  ON "attendance_logs" ("timestamp");

-- boarding_attendance_records.dormitory_id (migration 20261007000000)
ALTER TABLE "boarding_attendance_records"
  ADD COLUMN IF NOT EXISTS "dormitory_id" BIGINT;
CREATE INDEX IF NOT EXISTS "boarding_attendance_records_dormitory_id_idx"
  ON "boarding_attendance_records" ("dormitory_id");

-- Activate pending/inactive users so they can log in to the portal
-- pending = account created but email not verified — safe to activate
UPDATE users SET status = 'active'
  WHERE status IN ('pending', 'inactive');
SQLEOF
echo "✓ Safety patches applied"

echo "  Building backend TypeScript..."
npm run build
echo "✓ Backend built → dist/server.js"

# ── 6. Pull / clone frontend ──────────────────────────────────
echo ""
echo "[6/10] Pulling frontend ($FRONTEND_BRANCH) → $FRONTEND_DIR..."
mkdir -p "$FRONTEND_DIR"
if [ -d "$FRONTEND_DIR/.git" ]; then
  cd "$FRONTEND_DIR"
  git fetch origin
  git checkout "$FRONTEND_BRANCH"
  git reset --hard "origin/$FRONTEND_BRANCH"
else
  rm -rf "$FRONTEND_DIR"
  git clone -b "$FRONTEND_BRANCH" "$FRONTEND_REPO" "$FRONTEND_DIR"
  cd "$FRONTEND_DIR"
fi
echo "✓ Frontend pulled — $(git log --oneline -1)"

# ── 7. Build frontend ─────────────────────────────────────────
# NOTE: We build TWO versions of the frontend:
#   1. testing.ecareafrica.net → points to testing-api.ecareafrica.net
#   2. staging.ecareafrica.net → serves from /var/www/testing/frontend/dist
#      but staging nginx serves files directly (try_files), not via PM2
#      so we build the testing version and staging frontend is served from same dist
#      Staging uses its own nginx which routes /api/ to port 5600
echo ""
echo "[7/10] Building frontend..."
cd "$FRONTEND_DIR"
npm install

# Build STAGING first (staging.ecareafrica.net/api/v1)
echo "  Building staging frontend variant..."
echo "VITE_API_BASE_URL=https://staging.ecareafrica.net/api/v1" > "$FRONTEND_DIR/.env"
npm run build -- --outDir dist-staging 2>/dev/null \
  && echo "✓ Staging frontend built → $FRONTEND_DIR/dist-staging/" \
  || { echo "  (--outDir flag not supported, using sequential builds)"; }

# Build TESTING (testing-api.ecareafrica.net/api/v1)
# This is the final dist/ — also used by PM2 serve on port 4174
echo "VITE_API_BASE_URL=https://testing-api.ecareafrica.net/api/v1" > "$FRONTEND_DIR/.env"
npm run build
echo "✓ Testing frontend built → $FRONTEND_DIR/dist/"

# If staging build failed above (--outDir not supported), rebuild it now
# using the dist from testing as a base, then overwrite the JS with the right API URL
if [ ! -f "$FRONTEND_DIR/dist-staging/index.html" ]; then
  echo "  Rebuilding staging variant properly..."
  echo "VITE_API_BASE_URL=https://staging.ecareafrica.net/api/v1" > "$FRONTEND_DIR/.env"
  npm run build -- --outDir dist-staging \
    || { cp -r "$FRONTEND_DIR/dist" "$FRONTEND_DIR/dist-staging"; echo "  Warning: staging is a copy of testing dist — API URL may differ"; }
  echo "VITE_API_BASE_URL=https://testing-api.ecareafrica.net/api/v1" > "$FRONTEND_DIR/.env"
fi
echo "✓ Both frontend builds complete"

# ── 8. Start PM2 processes ────────────────────────────────────
echo ""
echo "[8/10] Starting PM2 processes..."
cd "$BACKEND_DIR"

# Testing backend on port 5501
PORT=$TESTING_PORT pm2 start dist/server.js \
  --name "$PM2_TESTING_BACKEND" \
  --time

# Staging backend on port 5600 (what staging nginx proxies to)
PORT=$STAGING_PORT pm2 start dist/server.js \
  --name "$PM2_STAGING_BACKEND" \
  --time

# Testing frontend static server
pm2 serve "$FRONTEND_DIR/dist" $FRONTEND_PORT \
  --name "$PM2_FRONTEND" --spa --time

pm2 save
pm2 startup 2>/dev/null || true
echo "✓ All PM2 processes started"

# ── 9. Nginx config ───────────────────────────────────────────
echo ""
echo "[9/10] Updating nginx testing config..."
NGINX_CONF="$BACKEND_DIR/deployment/linux/ecareafrica-testing-nginx.conf"
if [ -f "$NGINX_CONF" ]; then
  # Strip BOM if present (prevents 'unknown directive' nginx error)
  sed -i '1s/^\xEF\xBB\xBF//' "$NGINX_CONF"
  cp "$NGINX_CONF" /etc/nginx/sites-available/ecareafrica-testing
  ln -sf /etc/nginx/sites-available/ecareafrica-testing \
         /etc/nginx/sites-enabled/ecareafrica-testing
  nginx -t && nginx -s reload
  echo "✓ Nginx testing config applied and reloaded"
else
  echo "⚠ Nginx testing conf not found at $NGINX_CONF — skipping"
fi

# ── 10. Done ──────────────────────────────────────────────────
echo ""
echo "[10/10] Done!"
echo ""
pm2 list
echo ""
echo "  Testing  Frontend → https://testing.ecareafrica.net    (PM2 serve → port $FRONTEND_PORT)"
echo "  Testing  Backend  → https://testing-api.ecareafrica.net/api/v1  (port $TESTING_PORT)"
echo "  Staging  Frontend → https://staging.ecareafrica.net    (nginx → dist-staging/)"
echo "  Staging  Backend  → https://staging.ecareafrica.net/api/v1 (nginx → port $STAGING_PORT)"
echo ""
echo "Logs:"
echo "  pm2 logs $PM2_TESTING_BACKEND"
echo "  pm2 logs $PM2_STAGING_BACKEND"
echo "  pm2 logs $PM2_FRONTEND"
echo ""
echo "Health checks:"
echo "  curl -s http://localhost:$TESTING_PORT/api/v1/health"
echo "  curl -s http://localhost:$STAGING_PORT/api/v1/health"
