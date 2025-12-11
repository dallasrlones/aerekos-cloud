#!/bin/bash

# Docker-based testing script for aerekos-cloud
# Tests worker registration with everything dockerized

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Docker Testing Script for aerekos-cloud${NC}"
echo "=========================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ Root .env not found, creating from .env_example${NC}"
    cp .env_example .env
fi

# Check conductor .env
if [ ! -f "conductor/.env" ]; then
    echo -e "${YELLOW}⚠ Conductor .env not found, creating from .env_example${NC}"
    cd conductor
    cp .env_example .env
    echo -e "${YELLOW}⚠ Please edit conductor/.env and set JWT_SECRET${NC}"
    cd ..
fi

# Start conductor and frontend
echo -e "${BLUE}🚀 Starting conductor and frontend...${NC}"
docker-compose up -d conductor frontend

echo ""
echo -e "${GREEN}✓ Conductor and frontend starting...${NC}"
echo ""
echo "Waiting for services to be ready..."
sleep 5

# Check if conductor is ready
echo "Checking conductor health..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Conductor is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Conductor failed to start${NC}"
        docker-compose logs conductor
        exit 1
    fi
    sleep 2
done

echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo "1. Open http://localhost:19006 in your browser"
echo "2. Login with: admin / admin"
echo "3. Go to Settings → View registration token"
echo "4. Copy the token"
echo ""
read -p "Press Enter after you've copied the token..."

echo ""
read -p "Enter the registration token: " REG_TOKEN

if [ -z "$REG_TOKEN" ]; then
    echo -e "${RED}✗ No token provided${NC}"
    exit 1
fi

# Update .env with token
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if grep -q "WORKER_TOKEN" .env; then
        sed -i '' "s|WORKER_TOKEN=.*|WORKER_TOKEN=$REG_TOKEN|" .env
    else
        echo "WORKER_TOKEN=$REG_TOKEN" >> .env
    fi
else
    # Linux
    if grep -q "WORKER_TOKEN" .env; then
        sed -i "s|WORKER_TOKEN=.*|WORKER_TOKEN=$REG_TOKEN|" .env
    else
        echo "WORKER_TOKEN=$REG_TOKEN" >> .env
    fi
fi

echo -e "${GREEN}✓ Token saved to .env${NC}"

# Start worker
echo ""
echo -e "${BLUE}🔄 Starting worker...${NC}"
docker-compose up -d worker

echo ""
echo -e "${GREEN}✓ Worker starting...${NC}"
echo ""
echo "Waiting for worker to register..."
sleep 5

# Check worker health
echo "Checking worker health..."
for i in {1..20}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Worker is ready!${NC}"
        break
    fi
    if [ $i -eq 20 ]; then
        echo -e "${YELLOW}⚠ Worker may still be starting...${NC}"
    fi
    sleep 2
done

echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo ""
echo "Conductor API: http://localhost:3000"
echo "Frontend: http://localhost:19006"
echo "Worker API: http://localhost:3001"
echo ""
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo "View logs:"
echo "  docker-compose logs -f"
echo ""
echo "View devices:"
echo "  Open http://localhost:19006/devices"
echo ""
echo "Stop services:"
echo "  docker-compose down"

