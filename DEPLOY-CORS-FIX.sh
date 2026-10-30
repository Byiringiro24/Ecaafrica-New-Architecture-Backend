#!/bin/bash

# CORS Fix Deployment Script
# Run this on your production server

set -e

echo "🚀 Deploying CORS Fix to Production"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create .env file first"
    exit 1
fi

echo "📋 Step 1: Checking current .env configuration..."
echo ""

# Check required variables
check_env_var() {
    local var_name=$1
    local var_value=$(grep "^${var_name}=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ Missing: $var_name${NC}"
        return 1
    else
        echo -e "${GREEN}✓ Found: $var_name=$var_value${NC}"
        return 0
    fi
}

missing_vars=0

check_env_var "CORS_ORIGIN" || missing_vars=$((missing_vars + 1))
check_env_var "NODE_ENV" || missing_vars=$((missing_vars + 1))
check_env_var "TRUST_PROXY" || missing_vars=$((missing_vars + 1))

if [ $missing_vars -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Missing $missing_vars required environment variable(s)${NC}"
    echo ""
    echo "Required variables:"
    echo "  CORS_ORIGIN=https://ecareafrica.net,https://www.ecareafrica.net"
    echo "  NODE_ENV=production"
    echo "  TRUST_PROXY=true"
    echo ""
    echo "Please update your .env file and run this script again"
    exit 1
fi

echo ""
echo "📋 Step 2: Verifying CORS_ORIGIN includes frontend domain..."
CORS_VALUE=$(grep "^CORS_ORIGIN=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [[ ! "$CORS_VALUE" == *"ecareafrica.net"* ]]; then
    echo -e "${RED}❌ CORS_ORIGIN doesn't include ecareafrica.net${NC}"
    echo "Current value: $CORS_VALUE"
    echo "Should include: https://ecareafrica.net"
    exit 1
fi

echo -e "${GREEN}✓ CORS_ORIGIN correctly configured${NC}"
echo ""

echo "📋 Step 3: Building backend (if needed)..."
if [ -f "package.json" ]; then
    if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
        echo "Building TypeScript..."
        npm run build || {
            echo -e "${RED}❌ Build failed${NC}"
            exit 1
        }
        echo -e "${GREEN}✓ Build successful${NC}"
    else
        echo "Build is up to date"
    fi
fi

echo ""
echo "📋 Step 4: Restarting backend service..."

# Detect process manager
if command -v pm2 &> /dev/null; then
    echo "Using PM2..."
    pm2 restart ecareafrica-backend --update-env || {
        echo -e "${YELLOW}⚠ PM2 restart failed, trying 'all'...${NC}"
        pm2 restart all --update-env
    }
    echo -e "${GREEN}✓ PM2 restart successful${NC}"
    
    echo ""
    echo "📋 Checking PM2 logs for CORS configuration..."
    sleep 2
    pm2 logs ecareafrica-backend --lines 20 --nostream | grep -i "cors" || echo "No CORS logs found yet"
    
elif systemctl is-active --quiet ecareafrica-backend; then
    echo "Using systemd..."
    sudo systemctl restart ecareafrica-backend
    echo -e "${GREEN}✓ Systemd restart successful${NC}"
    
    echo ""
    echo "📋 Checking systemd logs..."
    sleep 2
    journalctl -u ecareafrica-backend -n 20 --no-pager | grep -i "cors" || echo "No CORS logs found yet"
    
elif command -v docker-compose &> /dev/null && [ -f "docker-compose.yml" ]; then
    echo "Using Docker Compose..."
    docker-compose restart backend
    echo -e "${GREEN}✓ Docker restart successful${NC}"
    
else
    echo -e "${YELLOW}⚠ No process manager detected${NC}"
    echo "Please manually restart your backend service"
fi

echo ""
echo "📋 Step 5: Testing CORS configuration..."
sleep 3

# Test with curl
echo ""
echo "Testing OPTIONS request..."
CORS_TEST=$(curl -s -I -X OPTIONS https://backend.ecareafrica.net/api/v1/auth/login \
  -H "Origin: https://ecareafrica.net" \
  -H "Access-Control-Request-Method: POST" 2>&1)

if echo "$CORS_TEST" | grep -qi "access-control-allow-origin"; then
    echo -e "${GREEN}✓ CORS headers present!${NC}"
    echo "$CORS_TEST" | grep -i "access-control"
else
    echo -e "${RED}❌ CORS headers NOT found${NC}"
    echo ""
    echo "Response:"
    echo "$CORS_TEST"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check if backend is running: pm2 list"
    echo "2. Check backend logs: pm2 logs ecareafrica-backend"
    echo "3. Verify nginx is proxying to backend correctly"
    exit 1
fi

echo ""
echo "Testing health endpoint..."
HEALTH_TEST=$(curl -s https://backend.ecareafrica.net/api/health)

if echo "$HEALTH_TEST" | grep -q "production"; then
    echo -e "${GREEN}✓ Health endpoint working${NC}"
    echo "$HEALTH_TEST" | jq '.' 2>/dev/null || echo "$HEALTH_TEST"
else
    echo -e "${YELLOW}⚠ Health endpoint returned unexpected response${NC}"
    echo "$HEALTH_TEST"
fi

echo ""
echo "===================================="
echo -e "${GREEN}✅ CORS Fix Deployed Successfully!${NC}"
echo "===================================="
echo ""
echo "Next steps:"
echo "1. Test login from https://ecareafrica.net"
echo "2. Monitor logs: pm2 logs ecareafrica-backend"
echo "3. Check for CORS request logs"
echo ""
echo "If issues persist:"
echo "  - Run: node test-cors.js"
echo "  - Check: PRODUCTION-CORS-FIX.md"
echo ""
