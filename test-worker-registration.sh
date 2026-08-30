#!/bin/bash

# Quick test script for worker registration on same device
# This script helps test worker registration locally

set -e

echo "🚀 Testing Worker Registration"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if conductor is running
echo "📡 Checking if conductor is running..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Conductor is running${NC}"
else
    echo -e "${RED}✗ Conductor is not running${NC}"
    echo "Please start conductor first:"
    echo "  cd conductor && npm start"
    exit 1
fi

# Get registration token (requires login)
echo ""
echo "🔑 Getting registration token..."
echo "Note: You'll need to login first. Default credentials: admin/admin"
echo ""
read -p "Enter your auth token (or press Enter to skip): " AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}⚠ Skipping token fetch. You can get it from the frontend Settings page.${NC}"
    echo ""
    read -p "Enter registration token manually: " REG_TOKEN
else
    REG_TOKEN=$(curl -s http://localhost:3000/api/token \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$REG_TOKEN" ]; then
        echo -e "${RED}✗ Failed to get registration token${NC}"
        echo "You can get it from the frontend Settings page instead"
        read -p "Enter registration token manually: " REG_TOKEN
    else
        echo -e "${GREEN}✓ Got registration token${NC}"
    fi
fi

if [ -z "$REG_TOKEN" ]; then
    echo -e "${RED}✗ No registration token provided${NC}"
    exit 1
fi

# Check worker directory
if [ ! -d "worker" ]; then
    echo -e "${RED}✗ Worker directory not found${NC}"
    exit 1
fi

# Create/update worker .env
echo ""
echo "⚙️  Configuring worker..."
cd worker

if [ ! -f ".env" ]; then
    cp .env_example .env
fi

# Update .env with token
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|CONDUCTOR_TOKEN=.*|CONDUCTOR_TOKEN=$REG_TOKEN|" .env
    sed -i '' "s|CONDUCTOR_URL=.*|CONDUCTOR_URL=http://localhost:3000|" .env
else
    # Linux
    sed -i "s|CONDUCTOR_TOKEN=.*|CONDUCTOR_TOKEN=$REG_TOKEN|" .env
    sed -i "s|CONDUCTOR_URL=.*|CONDUCTOR_URL=http://localhost:3000|" .env
fi

echo -e "${GREEN}✓ Worker configured${NC}"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing worker dependencies..."
    npm install
fi

# Start worker
echo ""
echo "🔄 Starting worker..."
echo "Press Ctrl+C to stop"
echo ""
npm start

