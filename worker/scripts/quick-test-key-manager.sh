#!/bin/bash

# Quick test script for key_manager deployment
# This script runs through the deployment flow step by step

set -e

echo "=========================================="
echo "Key Manager Deployment Quick Test"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker
echo -e "${YELLOW}[1/8]${NC} Checking Docker..."
if docker ps > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker is running"
else
    echo -e "${RED}✗${NC} Docker is not running"
    exit 1
fi

# Check key_manager directory
echo -e "${YELLOW}[2/8]${NC} Checking key_manager directory..."
if [ -d "key_manager" ]; then
    echo -e "${GREEN}✓${NC} key_manager directory exists"
else
    echo -e "${RED}✗${NC} key_manager directory not found"
    exit 1
fi

# Check Dockerfile
echo -e "${YELLOW}[3/8]${NC} Checking Dockerfile..."
if [ -f "key_manager/Dockerfile.dev" ]; then
    echo -e "${GREEN}✓${NC} Dockerfile.dev exists"
else
    echo -e "${RED}✗${NC} Dockerfile.dev not found"
    exit 1
fi

# Check aerekos-record (npm dependency of key_manager)
echo -e "${YELLOW}[4/8]${NC} Checking aerekos-record npm package..."
if (cd key_manager && node -e "require('aerekos-record')" 2>/dev/null); then
    echo -e "${GREEN}✓${NC} aerekos-record resolvable from key_manager (run \`cd key_manager && npm install\` if this fails)"
else
    echo -e "${RED}✗${NC} aerekos-record not installed — run: cd key_manager && npm install"
    exit 1
fi

# Check for existing container
echo -e "${YELLOW}[5/8]${NC} Checking for existing container..."
if docker ps -a --format '{{.Names}}' | grep -q "^aerekos-key_manager$"; then
    echo -e "${YELLOW}⚠${NC} Container exists"
    echo "  Stopping and removing existing container..."
    docker stop aerekos-key_manager 2>/dev/null || true
    docker rm aerekos-key_manager 2>/dev/null || true
else
    echo -e "${GREEN}✓${NC} No existing container"
fi

# Check port availability
echo -e "${YELLOW}[6/8]${NC} Checking port 3002..."
if lsof -i :3002 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC} Port 3002 is in use"
    echo "  You may need to stop the process using port 3002"
else
    echo -e "${GREEN}✓${NC} Port 3002 is available"
fi

# Run Node.js test script
echo -e "${YELLOW}[7/8]${NC} Running deployment test script..."
echo ""
node scripts/test-key-manager-deployment.js

# Final check
echo ""
echo -e "${YELLOW}[8/8]${NC} Final status check..."
sleep 2

if docker ps --format '{{.Names}}' | grep -q "^aerekos-key_manager$"; then
    echo -e "${GREEN}✓${NC} Container is running"
    
    # Check health
    echo ""
    echo "Checking health endpoint..."
    sleep 3
    if curl -s http://localhost:3002/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Health endpoint responding"
        curl -s http://localhost:3002/health | jq . || echo "Response received (not JSON)"
    else
        echo -e "${YELLOW}⚠${NC} Health endpoint not responding yet (may need more time)"
    fi
    
    echo ""
    echo "Container logs (last 20 lines):"
    docker logs --tail 20 aerekos-key_manager
else
    echo -e "${RED}✗${NC} Container is not running"
    echo ""
    echo "Checking logs..."
    docker logs aerekos-key_manager 2>&1 | tail -30
fi

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
