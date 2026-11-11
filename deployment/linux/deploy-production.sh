#!/bin/bash
# ============================================================
# EcaAfrica — PRODUCTION Deployment Script
#
# Server  : root@169.58.124.150
# Paths   : /var/www/ecare/backend   /var/www/ecare/frontend
# Ports   : Backend 5500  |  Frontend (ecosystem.config.js → npx serve → 4173)
# Domains : ecareafrica.net  |  backend.ecareafrica.net
# DB      : ecareafrica (PostgreSQL)
#
# Run FROM the server:
#   ssh root@169.58.124.150
#   curl -sL https://raw.githubusercontent.com/Byiringiro24/Ecaafrica-New-Architecture-Backend/main/deployment/linux/deploy-production.sh | bash
# ============================================================

set -e

BACKEND_REPO="https://github.com/Byiringiro24/Ecaafrica-New-Architecture-Backend.git"
FRONTEND_REPO="https://github.com/Byiringiro24/Ecaafrica-New-Architecture-Frontend.git"
BACKEND_BRANCH="main"
FRONTEND_BRANCH="main"
BACKEND_DIR="/var/www/ecare/backend"
FRONTEND_DIR="/var/www/ecare/frontend"
BACKEND_PORT=5500
FRONTEND_PORT=4173

# ── Force HTTPS remotes (no SSH keys on server) ───────────────
if [ -d "$BACKEND_DIR/.git" ]; then
  git -C "$BACKEND_DIR" remote set-url origin "$BACKEND_REPO" 2>/dev/null || true
fi
if [ -d "$FRONTEND_DIR/.git" ]; then
  git -C "$FRONTEND_DIR" remote set-url origin "$FRONTEND_REPO" 2>/dev/null || true
fi

echo "============================================"
echo "  EcaAfrica PRODUCTION Deployment"
echo "  Backend  : $BACKEND_DIR  (port $BACKEND_PORT)"
echo "  Frontend : $FRONTEND_DIR (port $FRONTEND_PORT)"
echo "  Branch   : $BACKEND_BRANCH"
echo "============================================"

# ── 1. Stop production PM2 processes only ─────────────────────
# Stops by NAME so staging/testing processes are never touched.
echo ""
echo "[1/10] Stopping production PM2 processes..."
pm2 stop  "ecare-backend"  2>/dev/null || true
pm2 stop  "ecare-frontend" 2>/dev/null || true
pm2 delete "ecare-backend"  2>/dev/null || true
pm2 delete "ecare-frontend" 2>/dev/null || true
fuser -k ${BACKEND_PORT}/tcp  2>/dev/null || true
fuser -k ${FRONTEND_PORT}/tcp 2>/dev/null || true
echo "✓ Production PM2 stopped, ports freed"

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
#   - .env does not exist       → write full defaults
#   - key already in .env       → leave untouched (server admin value wins)
#   - key MISSING from .env     → append it
# This means DATABASE_URL, passwords, and secrets set manually on
# the server are NEVER overwritten by a redeploy.
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

# ── Database ──────────────────────────────────────────────────
merge_env "DATABASE_URL"               '"postgresql://postgres:2211@localhost:5432/ecareafrica?schema=public"' "$ENV_FILE"

# ── JWT ───────────────────────────────────────────────────────
merge_env "JWT_SECRET"                 "1b1a90a340949c666a212b212de76a9c7e14d24a5cd9c6b1de32d517668501b1" "$ENV_FILE"
merge_env "JWT_REFRESH_SECRET"         "hk3BkIhG-cEMddfdK3FIGsAgRL_16mQWxKDgnaRvdRwzbWC9ICwhQO0Kashg-DQEWjCnKz3tpxaG-K9Y2gyHrg" "$ENV_FILE"
merge_env "PLATFORM_JWT_SECRET"        "Gqwfm4cF1q3S2uX5nvdRkUZRQU40ZmcGRCBs4H666mgez6mNaU5iS7Mhjo3wSvKssqV2Sa0B7sFOk49181MEEw" "$ENV_FILE"
merge_env "PLATFORM_JWT_REFRESH_SECRET" "CL3gr3UNYYqfdcs8zdzvbMWkLn3rFRQn_BbkxOfOgFy1" "$ENV_FILE"
merge_env "JWT_EXPIRES_IN"             "15m" "$ENV_FILE"
merge_env "JWT_REFRESH_EXPIRES_IN"     "7d"  "$ENV_FILE"

# ── Server ────────────────────────────────────────────────────
merge_env "PORT"         "$BACKEND_PORT" "$ENV_FILE"
merge_env "NODE_ENV"     "production"    "$ENV_FILE"
merge_env "TZ"           "Africa/Kigali" "$ENV_FILE"
merge_env "TRUST_PROXY"  "true"          "$ENV_FILE"

merge_env "CORS_ORIGIN" \
  "https://ecareafrica.net,https://www.ecareafrica.net,https://backend.ecareafrica.net" \
  "$ENV_FILE"

merge_env "RATE_LIMIT_ENABLED"   "true"   "$ENV_FILE"
merge_env "RATE_LIMIT_WINDOW_MS" "900000" "$ENV_FILE"
merge_env "RATE_LIMIT_MAX"       "100"    "$ENV_FILE"

# ── Storage ───────────────────────────────────────────────────
merge_env "S3_ENDPOINT"       "https://abcd1234efgh.r2.cloudflarestorage.com" "$ENV_FILE"
merge_env "S3_REGION"         "auto"                                           "$ENV_FILE"
merge_env "S3_BUCKET"         "ecareafrica-storage"                            "$ENV_FILE"
merge_env "S3_ACCESS_KEY_ID"  "RboLlUqEo8Ojh9ALgoWC_yzWuVeZFoN2dlX4XKZ0eCZh7g" "$ENV_FILE"
merge_env "S3_SECRET_ACCESS_KEY" "RboLlUqEo8Ojh9ALgoWC_yzWuVeZFoN2dlX4XKZ0eCZh7g" "$ENV_FILE"
merge_env "S3_PUBLIC_URL"     "https://pub.r2.dev" "$ENV_FILE"

# ── Email ─────────────────────────────────────────────────────
merge_env "SMTP_HOST" "smtp.gmail.com"                 "$ENV_FILE"
merge_env "SMTP_PORT" "587"                            "$ENV_FILE"
merge_env "SMTP_USER" "netrackdevelopement@gmail.com" "$ENV_FILE"
merge_env "SMTP_PASS" "elkrdmcpmksazazy"               "$ENV_FILE"
merge_env "SMTP_FROM" "netrackdevelopement@gmail.com" "$ENV_FILE"

# ── Services ──────────────────────────────────────────────────
merge_env "REDIS_URL"           "redis://localhost:6379"              "$ENV_FILE"
merge_env "SMS_UGANDA_API_URL"  "http://text.emediauganda.com/api.php" "$ENV_FILE"
merge_env "SMS_UGANDA_USER"     "your_username"                       "$ENV_FILE"
merge_env "SMS_UGANDA_PASSWORD" "your_password"                       "$ENV_FILE"
merge_env "SMS_UGANDA_SENDER"   "EducationCare"                       "$ENV_FILE"
merge_env "APP_BASE_URL"        "https://ecareafrica.net"             "$ENV_FILE"

# ── WireGuard ─────────────────────────────────────────────────
merge_env "WG_CONF_PATH"     "/etc/wireguard/wg0.conf"          "$ENV_FILE"
merge_env "WG_PUBKEY_PATH"   "/etc/wireguard/server_public.key" "$ENV_FILE"
merge_env "WG_INTERFACE"     "wg0"                              "$ENV_FILE"
merge_env "VPN_SUBNET"       "10.0"                             "$ENV_FILE"
merge_env "VPN_CIDR"         "16"                               "$ENV_FILE"
merge_env "SERVER_VPN_IP"    "10.0.0.1"                         "$ENV_FILE"
merge_env "SERVER_PUBLIC_IP" "169.58.124.150"                   "$ENV_FILE"
merge_env "WG_PORT"          "51820"                            "$ENV_FILE"

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

# ── 4. Install dependencies ───────────────────────────────────
echo ""
echo "[4/10] Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --production=false
echo "✓ Dependencies installed"

# ── 5. Prisma ─────────────────────────────────────────────────
echo ""
echo "[5/10] Prisma generate + migrate deploy..."
npx prisma generate --schema src/models/schema.prisma
npx prisma migrate deploy --schema src/models/schema.prisma
# NOTE: seed is intentionally skipped — seed inserts demo data and would
# corrupt a live school database. To seed a fresh install run: npm run seed
echo "✓ Prisma ready (all migrations applied)"

# ── 6. Build ──────────────────────────────────────────────────
echo ""
echo "[6/10] Building backend TypeScript..."
npm run build
echo "✓ Backend built → dist/server.js"

# ── 7. Frontend ───────────────────────────────────────────────
echo ""
echo "[7/10] Pulling + building frontend..."
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

echo "VITE_API_BASE_URL=https://backend.ecareafrica.net/api/v1" > "$FRONTEND_DIR/.env"
cd "$FRONTEND_DIR"
npm install
npm run build
echo "✓ Frontend built → $FRONTEND_DIR/dist/"

# ── 8. Start with PM2 via ecosystem.config.js ─────────────────
# ecosystem.config.js starts:
#   ecare-backend  — cluster (1 per CPU), port 5500
#   ecare-frontend — npx serve dist/ on port 4173
echo ""
echo "[8/10] Starting with PM2 (ecosystem.config.js)..."
cd "$BACKEND_DIR"
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup 2>/dev/null || true
echo "✓ PM2 processes started"

# ── 9. Nginx ──────────────────────────────────────────────────
echo ""
echo "[9/10] Updating nginx production config..."
NGINX_CONF="$BACKEND_DIR/deployment/linux/ecareafrica-nginx.conf"
if [ -f "$NGINX_CONF" ]; then
  # Strip BOM if present (causes 'unknown directive' nginx error)
  sed -i '1s/^\xEF\xBB\xBF//' "$NGINX_CONF"
  cp "$NGINX_CONF" /etc/nginx/sites-available/ecareafrica
  ln -sf /etc/nginx/sites-available/ecareafrica /etc/nginx/sites-enabled/ecareafrica
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && nginx -s reload
  echo "✓ Nginx updated and reloaded"
else
  echo "⚠ nginx conf not found at $NGINX_CONF — skipping"
fi

# ── 10. Done ──────────────────────────────────────────────────
echo ""
echo "[10/10] Done!"
echo ""
pm2 list
echo ""
echo "  Production Frontend → https://ecareafrica.net"
echo "  Production Backend  → https://backend.ecareafrica.net/api/v1"
echo ""
echo "Health:"
echo "  curl -s http://localhost:$BACKEND_PORT/api/v1/health"
echo ""
echo "Logs:"
echo "  pm2 logs ecare-backend"
echo "  pm2 logs ecare-frontend"
