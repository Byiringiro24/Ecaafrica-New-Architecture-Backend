#!/bin/bash
# ============================================================
# EcaAfrica — TESTING Environment Deployment Script
# Server : root@169.58.124.150
# Paths  : /var/www/testing/backend   /var/www/testing/frontend
# Ports  : Backend 5501  |  Frontend 4174
# Domains: testing.ecareafrica.net  |  testing-api.ecareafrica.net
#
# Run FROM the server:
#   ssh root@169.58.124.150
#   curl -sL https://raw.githubusercontent.com/Byiringiro24/Ecaafrica-New-Architecture-Backend/main/deployment/linux/deploy-testing.sh | bash
# OR:
#   bash /var/www/testing/backend/deployment/linux/deploy-testing.sh
# ============================================================

set -e

BACKEND_REPO="https://github.com/Byiringiro24/Ecaafrica-New-Architecture-Backend.git"
FRONTEND_REPO="https://github.com/Byiringiro24/Ecaafrica-New-Architecture-Frontend.git"
BACKEND_BRANCH="main"
FRONTEND_BRANCH="main"
BACKEND_DIR="/var/www/testing/backend"
FRONTEND_DIR="/var/www/testing/frontend"

BACKEND_PORT=5501
FRONTEND_PORT=4174

PM2_BACKEND_NAME="ecare-testing-backend"
PM2_FRONTEND_NAME="ecare-testing-frontend"

# ── Force HTTPS remotes (no SSH keys on server) ───────────────
if [ -d "$BACKEND_DIR/.git" ]; then
  git -C "$BACKEND_DIR" remote set-url origin "$BACKEND_REPO" 2>/dev/null || true
fi
if [ -d "$FRONTEND_DIR/.git" ]; then
  git -C "$FRONTEND_DIR" remote set-url origin "$FRONTEND_REPO" 2>/dev/null || true
fi

echo "============================================"
echo "  EcaAfrica TESTING Deployment"
echo "  Backend  : $BACKEND_DIR  (port $BACKEND_PORT)"
echo "  Frontend : $FRONTEND_DIR (port $FRONTEND_PORT)"
echo "  Branch   : $BACKEND_BRANCH"
echo "============================================"

# ── 1. Stop existing testing PM2 processes ───────────────────
echo ""
echo "[1/10] Stopping testing PM2 processes..."
pm2 stop  "$PM2_BACKEND_NAME"  2>/dev/null || true
pm2 stop  "$PM2_FRONTEND_NAME" 2>/dev/null || true
pm2 delete "$PM2_BACKEND_NAME"  2>/dev/null || true
pm2 delete "$PM2_FRONTEND_NAME" 2>/dev/null || true
fuser -k ${BACKEND_PORT}/tcp  2>/dev/null || true
fuser -k ${FRONTEND_PORT}/tcp 2>/dev/null || true
echo "✓ Testing PM2 processes stopped, ports freed"

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

# ── 3. Merge backend .env for TESTING (never overwrite existing keys) ─
# merge_env KEY VALUE FILE
#   - If FILE does not exist → creates it with KEY=VALUE
#   - If KEY already present in FILE → leaves it untouched (existing value wins)
#   - If KEY is missing from FILE → appends KEY=VALUE
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
echo "[3/10] Merging backend .env (testing — existing keys preserved)..."
ENV_FILE="$BACKEND_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  echo "  ✓ Existing .env found — only adding missing keys"
else
  echo "  ✓ No .env found — creating fresh one"
fi

merge_env "DATABASE_URL"                 '"postgresql://postgres:2211@localhost:5432/ecareafrica_testing?schema=public"' "$ENV_FILE"
merge_env "JWT_SECRET"                   "1b1a90a340949c666a212b212de76a9c7e14d24a5cd9c6b1de32d517668501b1"             "$ENV_FILE"
merge_env "JWT_REFRESH_SECRET"           "hk3BkIhG-cEMddfdK3FIGsAgRL_16mQWxKDgnaRvdRwzbWC9ICwhQO0Kashg-DQEWjCnKz3tpxaG-K9Y2gyHrg" "$ENV_FILE"
merge_env "PLATFORM_JWT_SECRET"          "Gqwfm4cF1q3S2uX5nvdRkUZRQU40ZmcGRCBs4H666mgez6mNaU5iS7Mhjo3wSvKssqV2Sa0B7sFOk49181MEEw" "$ENV_FILE"
merge_env "PLATFORM_JWT_REFRESH_SECRET"  "CL3gr3UNYYqfdcs8zdzvbMWkLn3rFRQn_BbkxOfOgFy1"                               "$ENV_FILE"
merge_env "JWT_EXPIRES_IN"               "15m"                                                                          "$ENV_FILE"
merge_env "JWT_REFRESH_EXPIRES_IN"       "7d"                                                                           "$ENV_FILE"
merge_env "PORT"                         "$BACKEND_PORT"                                                                "$ENV_FILE"
merge_env "NODE_ENV"                     "production"                                                                   "$ENV_FILE"
merge_env "TZ"                           "Africa/Kigali"                                                                "$ENV_FILE"
merge_env "TRUST_PROXY"                  "true"                                                                         "$ENV_FILE"
merge_env "CORS_ORIGIN"                  "http://testing.ecareafrica.net,https://testing.ecareafrica.net,http://testing-api.ecareafrica.net,https://testing-api.ecareafrica.net" "$ENV_FILE"
merge_env "RATE_LIMIT_ENABLED"           "false"                                                                        "$ENV_FILE"
merge_env "RATE_LIMIT_WINDOW_MS"         "900000"                                                                       "$ENV_FILE"
merge_env "RATE_LIMIT_MAX"               "200"                                                                          "$ENV_FILE"
merge_env "S3_ENDPOINT"                  "https://abcd1234efgh.r2.cloudflarestorage.com"                               "$ENV_FILE"
merge_env "S3_REGION"                    "auto"                                                                         "$ENV_FILE"
merge_env "S3_BUCKET"                    "ecareafrica-storage"                                                          "$ENV_FILE"
merge_env "S3_ACCESS_KEY_ID"             "RboLlUqEo8Ojh9ALgoWC_yzWuVeZFoN2dlX4XKZ0eCZh7g"                             "$ENV_FILE"
merge_env "S3_SECRET_ACCESS_KEY"         "RboLlUqEo8Ojh9ALgoWC_yzWuVeZFoN2dlX4XKZ0eCZh7g"                             "$ENV_FILE"
merge_env "S3_PUBLIC_URL"                "https://pub.r2.dev"                                                           "$ENV_FILE"
merge_env "SMTP_HOST"                    "smtp.gmail.com"                                                               "$ENV_FILE"
merge_env "SMTP_PORT"                    "587"                                                                          "$ENV_FILE"
merge_env "SMTP_USER"                    "netrackdevelopement@gmail.com"                                                "$ENV_FILE"
merge_env "SMTP_PASS"                    "elkrdmcpmksazazy"                                                             "$ENV_FILE"
merge_env "SMTP_FROM"                    "netrackdevelopement@gmail.com"                                                "$ENV_FILE"
merge_env "REDIS_URL"                    "redis://localhost:6379"                                                       "$ENV_FILE"
merge_env "SMS_UGANDA_API_URL"           "http://text.emediauganda.com/api.php"                                        "$ENV_FILE"
merge_env "SMS_UGANDA_USER"              "your_username"                                                                "$ENV_FILE"
merge_env "SMS_UGANDA_PASSWORD"          "your_password"                                                                "$ENV_FILE"
merge_env "SMS_UGANDA_SENDER"            "EducationCare"                                                                "$ENV_FILE"
merge_env "APP_BASE_URL"                 "https://testing.ecareafrica.net"                                             "$ENV_FILE"
merge_env "WG_CONF_PATH"                 "/etc/wireguard/wg0.conf"                                                     "$ENV_FILE"
merge_env "WG_PUBKEY_PATH"               "/etc/wireguard/server_public.key"                                            "$ENV_FILE"
merge_env "WG_INTERFACE"                 "wg0"                                                                          "$ENV_FILE"
merge_env "VPN_SUBNET"                   "10.0"                                                                         "$ENV_FILE"
merge_env "VPN_CIDR"                     "16"                                                                           "$ENV_FILE"
merge_env "SERVER_VPN_IP"                "10.0.0.1"                                                                    "$ENV_FILE"
merge_env "SERVER_PUBLIC_IP"             "169.58.124.150"                                                               "$ENV_FILE"
merge_env "WG_PORT"                      "51820"                                                                        "$ENV_FILE"
merge_env "PULL_CONCURRENCY"             "10"                                                                           "$ENV_FILE"
merge_env "PULL_LOGS_INTERVAL_MS"        "5000"                                                                         "$ENV_FILE"
merge_env "PULL_TIMEOUT_MS"              "20000"                                                                        "$ENV_FILE"
merge_env "SSE_CONNECT_CONCURRENCY"      "10"                                                                           "$ENV_FILE"
merge_env "SSE_CONNECT_STAGGER_MS"       "200"                                                                          "$ENV_FILE"
merge_env "SSE_DEDUP_CACHE_SIZE"         "10000"                                                                        "$ENV_FILE"
merge_env "OFFLINE_FAIL_THRESHOLD"       "3"                                                                            "$ENV_FILE"

echo "✓ .env merge complete — existing values untouched"
echo "  Active DATABASE_URL: $(grep '^DATABASE_URL=' "$ENV_FILE" | head -1)"

# ── 4. Create testing DB if it does not exist ─────────────────
echo ""
echo "[4/10] Ensuring testing database exists..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'ecareafrica_testing'" | grep -q 1 \
  || psql -U postgres -c "CREATE DATABASE ecareafrica_testing OWNER postgres;"
echo "✓ Database ecareafrica_testing ready"

# ── 5. Backend: install, prisma, build ───────────────────────
echo ""
echo "[5/10] Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --production=false
echo "✓ Dependencies installed"

echo ""
echo "  Prisma generate + migrate..."
npx prisma generate --schema src/models/schema.prisma
npx prisma migrate deploy --schema src/models/schema.prisma
echo "✓ Prisma ready"

echo ""
echo "  Building backend..."
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

# ── 7. Build frontend with TESTING API URL ────────────────────
echo ""
echo "[7/10] Building frontend (testing)..."
echo "VITE_API_BASE_URL=https://testing-api.ecareafrica.net/api/v1" > "$FRONTEND_DIR/.env"
cd "$FRONTEND_DIR"
npm install
npm run build
echo "✓ Frontend built → $FRONTEND_DIR/dist/"

# ── 8. Start with PM2 ────────────────────────────────────────
echo ""
echo "[8/10] Starting TESTING processes with PM2..."

# Start backend — override PORT so it does not conflict with production
cd "$BACKEND_DIR"
PORT=$BACKEND_PORT pm2 start dist/server.js \
  --name "$PM2_BACKEND_NAME" \
  --time \
  -- --env production

echo "Starting testing frontend static server on port $FRONTEND_PORT..."
pm2 serve "$FRONTEND_DIR/dist" $FRONTEND_PORT --name "$PM2_FRONTEND_NAME" --spa --time

pm2 save
echo "✓ PM2 testing processes running"

# ── 9. Install / update nginx testing config ──────────────────
echo ""
echo "[9/10] Updating nginx testing config..."
NGINX_CONF="$BACKEND_DIR/deployment/linux/ecareafrica-testing-nginx.conf"
if [ -f "$NGINX_CONF" ]; then
  cp "$NGINX_CONF" /etc/nginx/sites-available/ecareafrica-testing
  ln -sf /etc/nginx/sites-available/ecareafrica-testing /etc/nginx/sites-enabled/ecareafrica-testing
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
echo "  Testing Frontend → http://testing.ecareafrica.net   (port $FRONTEND_PORT)"
echo "  Testing Backend  → http://testing-api.ecareafrica.net/api/v1  (port $BACKEND_PORT)"
echo ""
echo "Logs:  pm2 logs $PM2_BACKEND_NAME"
echo "       pm2 logs $PM2_FRONTEND_NAME"
