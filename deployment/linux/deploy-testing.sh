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

# ── 3. Write backend .env for TESTING ────────────────────────
echo ""
echo "[3/10] Writing backend .env (testing)..."
cat > "$BACKEND_DIR/.env" << 'ENVEOF'
DATABASE_URL="postgresql://postgres:2211@localhost:5432/ecareafrica_testing?schema=public"

JWT_SECRET=1b1a90a340949c666a212b212de76a9c7e14d24a5cd9c6b1de32d517668501b1
JWT_REFRESH_SECRET=hk3BkIhG-cEMddfdK3FIGsAgRL_16mQWxKDgnaRvdRwzbWC9ICwhQO0Kashg-DQEWjCnKz3tpxaG-K9Y2gyHrg
PLATFORM_JWT_SECRET=Gqwfm4cF1q3S2uX5nvdRkUZRQU40ZmcGRCBs4H666mgez6mNaU5iS7Mhjo3wSvKssqV2Sa0B7sFOk49181MEEw
PLATFORM_JWT_REFRESH_SECRET=CL3gr3UNYYqfdcs8zdzvbMWkLn3rFRQn_BbkxOfOgFy1
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

PORT=5501
NODE_ENV=production
TZ=Africa/Kigali
TRUST_PROXY=true

CORS_ORIGIN=http://testing.ecareafrica.net,https://testing.ecareafrica.net,http://testing-api.ecareafrica.net,https://testing-api.ecareafrica.net

RATE_LIMIT_ENABLED=false
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200

S3_ENDPOINT=https://abcd1234efgh.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=ecareafrica-storage
S3_ACCESS_KEY_ID=RboLlUqEo8Ojh9ALgoWC_yzWuVeZFoN2dlX4XKZ0eCZh7g
S3_SECRET_ACCESS_KEY=RboLlUqEo8Ojh9ALgoWC_yzWuVeZFoN2dlX4XKZ0eCZh7g
S3_PUBLIC_URL=https://pub.r2.dev

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=netrackdevelopement@gmail.com
SMTP_PASS=elkrdmcpmksazazy
SMTP_FROM=netrackdevelopement@gmail.com

REDIS_URL=redis://localhost:6379

SMS_UGANDA_API_URL=http://text.emediauganda.com/api.php
SMS_UGANDA_USER=your_username
SMS_UGANDA_PASSWORD=your_password
SMS_UGANDA_SENDER=EducationCare

APP_BASE_URL=https://testing.ecareafrica.net

WG_CONF_PATH=/etc/wireguard/wg0.conf
WG_PUBKEY_PATH=/etc/wireguard/server_public.key
WG_INTERFACE=wg0
VPN_SUBNET=10.0
VPN_CIDR=16
SERVER_VPN_IP=10.0.0.1
SERVER_PUBLIC_IP=169.58.124.150
WG_PORT=51820

PULL_CONCURRENCY=10
PULL_LOGS_INTERVAL_MS=5000
PULL_TIMEOUT_MS=20000
SSE_CONNECT_CONCURRENCY=10
SSE_CONNECT_STAGGER_MS=200
SSE_DEDUP_CACHE_SIZE=10000
ENVEOF
echo "✓ Backend .env written (PORT=$BACKEND_PORT, DB=ecareafrica_testing)"

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
