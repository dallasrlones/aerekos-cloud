#!/bin/bash

# Full flow test script for key_manager deployment
# Tests: Enable → Container Starts → API Works → Stop → Auto-Restart → API Still Works

set -e

echo "=========================================="
echo "Key Manager Full Flow Test"
echo "=========================================="
echo ""

CONDUCTOR_URL="${CONDUCTOR_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-your-token-here}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
print_step() {
    echo -e "\n${BLUE}[Step $1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Step 1: Enable service
print_step "1" "Enabling key_manager service via conductor..."
RESPONSE=$(curl -s -X POST "${CONDUCTOR_URL}/api/services/key_manager/enable" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" 2>&1)

if echo "$RESPONSE" | grep -q "success\|worker_id"; then
    print_success "Service enabled"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
else
    print_error "Failed to enable service"
    echo "$RESPONSE"
    exit 1
fi

# Step 2: Wait for container to start
print_step "2" "Waiting for container to start (10 seconds)..."
sleep 10

# Step 3: Check container status
print_step "3" "Checking container status..."
if docker ps --format '{{.Names}}' | grep -q "^aerekos-key_manager$"; then
    print_success "Container is running"
    docker ps --filter "name=aerekos-key_manager" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    print_error "Container is not running"
    echo "Checking if container exists..."
    docker ps -a --filter "name=aerekos-key_manager" --format "table {{.Names}}\t{{.Status}}"
    echo ""
    echo "Container logs:"
    docker logs aerekos-key_manager --tail 50 2>&1 || true
    exit 1
fi

# Step 4: Check service registration
print_step "4" "Checking if service registered with conductor..."
SERVICE_RESPONSE=$(curl -s "${CONDUCTOR_URL}/api/services/key_manager" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" 2>&1)

if echo "$SERVICE_RESPONSE" | grep -q "key_manager\|service_id"; then
    print_success "Service registered with conductor"
    echo "$SERVICE_RESPONSE" | jq . 2>/dev/null || echo "$SERVICE_RESPONSE"
else
    print_warn "Service may not be registered yet (check logs)"
fi

# Step 5: Test health endpoint
print_step "5" "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "http://localhost:3002/health" 2>&1)

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    print_success "Health endpoint responding"
    echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    print_warn "Health endpoint not responding as expected"
    echo "$HEALTH_RESPONSE"
fi

# Step 6: Test API via conductor proxy
print_step "6" "Testing API via conductor proxy..."
API_RESPONSE=$(curl -s "${CONDUCTOR_URL}/api/services/key_manager/api/keys" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" 2>&1)

if echo "$API_RESPONSE" | grep -q "keys\|\[\]"; then
    print_success "API proxy working"
    echo "$API_RESPONSE" | jq . 2>/dev/null || echo "$API_RESPONSE"
else
    print_warn "API proxy may have issues"
    echo "$API_RESPONSE"
fi

# Step 7: Stop container and test auto-restart
print_step "7" "Stopping container to test auto-restart..."
docker stop aerekos-key_manager
print_success "Container stopped"

print_step "8" "Waiting for auto-restart (35 seconds for monitoring interval)..."
sleep 35

# Step 8: Check if container restarted
print_step "9" "Checking if container auto-restarted..."
if docker ps --format '{{.Names}}' | grep -q "^aerekos-key_manager$"; then
    print_success "Container auto-restarted successfully!"
    docker ps --filter "name=aerekos-key_manager" --format "table {{.Names}}\t{{.Status}}"
else
    print_error "Container did not auto-restart"
    echo "Checking container status..."
    docker ps -a --filter "name=aerekos-key_manager" --format "table {{.Names}}\t{{.Status}}"
    echo ""
    echo "Check worker logs for restart attempts"
fi

# Step 9: Verify API still works
print_step "10" "Verifying API still works after restart..."
sleep 5
API_RESPONSE2=$(curl -s "${CONDUCTOR_URL}/api/services/key_manager/api/keys" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" 2>&1)

if echo "$API_RESPONSE2" | grep -q "keys\|\[\]"; then
    print_success "API still working after restart"
else
    print_warn "API may need more time to be ready"
    echo "$API_RESPONSE2"
fi

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Service enabled: ✓"
echo "- Container started: $(docker ps --format '{{.Names}}' | grep -q '^aerekos-key_manager$' && echo '✓' || echo '✗')"
echo "- Auto-restart: $(docker ps --format '{{.Names}}' | grep -q '^aerekos-key_manager$' && echo '✓' || echo '✗')"
echo "- API accessible: $(curl -s "${CONDUCTOR_URL}/api/services/key_manager/api/keys" -H "Authorization: Bearer ${AUTH_TOKEN}" >/dev/null 2>&1 && echo '✓' || echo '✗')"
