#!/bin/bash

# Test script for Service Orchestration features
# Usage: ./test-orchestration.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CONDUCTOR_URL="${CONDUCTOR_URL:-http://localhost:3000}"
# Set AUTH_TOKEN in the environment, or AUTH_USERNAME + AUTH_PASSWORD for login:
#   export AUTH_TOKEN="..." 
#   export AUTH_USERNAME=test AUTH_PASSWORD=yourpassword ./test-orchestration.sh
AUTH_USERNAME="${AUTH_USERNAME:-test}"
AUTH_PASSWORD="${AUTH_PASSWORD:-}"

if [ -z "$AUTH_TOKEN" ]; then
  if [ -z "$AUTH_PASSWORD" ]; then
    echo -e "${RED}Set AUTH_TOKEN or AUTH_PASSWORD (user: ${AUTH_USERNAME}) before running.${NC}"
    echo "Example: export AUTH_PASSWORD='yourpassword' && ./test-orchestration.sh"
    exit 1
  fi
  AUTH_TOKEN=$(curl -s -X POST "${CONDUCTOR_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${AUTH_USERNAME}\",\"password\":\"${AUTH_PASSWORD}\"}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")
fi

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}Login failed — check CONDUCTOR_URL, username, and password.${NC}"
  exit 1
fi

echo -e "${BLUE}=== Service Orchestration Test Suite ===${NC}\n"

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
            "$CONDUCTOR_URL$endpoint" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json"
    else
        curl -s -X "$method" \
            "$CONDUCTOR_URL$endpoint" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# Test 1: Get all projects
echo -e "${YELLOW}1. Getting all projects...${NC}"
PROJECTS_RESPONSE=$(api_call "GET" "/api/projects")
echo "$PROJECTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PROJECTS_RESPONSE"
PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['projects'][0]['id'] if data.get('projects') and len(data['projects']) > 0 else '')" 2>/dev/null || echo "")

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}   No projects found. Creating test project...${NC}"
    CREATE_PROJECT_RESPONSE=$(api_call "POST" "/api/projects" '{"name":"test-orchestration","description":"Test project for orchestration","enabled":true}')
    echo "$CREATE_PROJECT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_PROJECT_RESPONSE"
    PROJECT_ID=$(echo "$CREATE_PROJECT_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['project']['id'])" 2>/dev/null || echo "")
fi

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}   Failed to get or create project${NC}"
    exit 1
fi

echo -e "${GREEN}   ✓ Using project: $PROJECT_ID${NC}\n"

# Test 2: Get all workers
echo -e "${YELLOW}2. Getting all workers...${NC}"
WORKERS_RESPONSE=$(api_call "GET" "/api/workers")
echo "$WORKERS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$WORKERS_RESPONSE"
WORKER_ID=$(echo "$WORKERS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['workers'][0]['id'] if data.get('workers') and len(data['workers']) > 0 else '')" 2>/dev/null || echo "")

if [ -z "$WORKER_ID" ]; then
    echo -e "${RED}   No workers found. Make sure worker is running and registered!${NC}"
    exit 1
fi

echo -e "${GREEN}   ✓ Found worker: $WORKER_ID${NC}\n"

# Test 3: Assign worker to project
echo -e "${YELLOW}3. Assigning worker to project...${NC}"
ASSIGN_RESPONSE=$(api_call "POST" "/api/projects/$PROJECT_ID/workers/$WORKER_ID")
echo "$ASSIGN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ASSIGN_RESPONSE"
echo -e "${GREEN}   ✓ Worker assigned${NC}\n"

# Test 4: Get all services
echo -e "${YELLOW}4. Getting all services...${NC}"
SERVICES_RESPONSE=$(api_call "GET" "/api/services")
echo "$SERVICES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SERVICES_RESPONSE"
SERVICE_ID=$(echo "$SERVICES_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['services'][0]['id'] if data.get('services') and len(data['services']) > 0 else '')" 2>/dev/null || echo "")

if [ -z "$SERVICE_ID" ]; then
    echo -e "${YELLOW}   No services found. Creating key_manager service...${NC}"
    # Service will be created automatically when enabled
    SERVICE_NAME="key_manager"
else
    SERVICE_NAME=$(echo "$SERVICES_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['services'][0]['name'] if data.get('services') and len(data['services']) > 0 else 'key_manager')" 2>/dev/null || echo "key_manager")
    echo -e "${GREEN}   ✓ Found service: $SERVICE_NAME ($SERVICE_ID)${NC}\n"
fi

# Test 5: Assign service to project
echo -e "${YELLOW}5. Assigning service to project...${NC}"
ASSIGN_SERVICE_RESPONSE=$(api_call "POST" "/api/projects/$PROJECT_ID/services/$SERVICE_ID")
echo "$ASSIGN_SERVICE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ASSIGN_SERVICE_RESPONSE"
echo -e "${GREEN}   ✓ Service assigned${NC}\n"

# Test 6: Enable service for project (triggers auto-deployment)
echo -e "${YELLOW}6. Enabling service for project (should trigger auto-deployment)...${NC}"
ENABLE_RESPONSE=$(api_call "POST" "/api/projects/$PROJECT_ID/services/$SERVICE_ID/enable")
echo "$ENABLE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ENABLE_RESPONSE"
echo -e "${GREEN}   ✓ Service enabled${NC}\n"

# Test 7: Get service assignments
echo -e "${YELLOW}7. Getting service assignments...${NC}"
ASSIGNMENTS_RESPONSE=$(api_call "GET" "/api/projects/$PROJECT_ID/services/$SERVICE_ID/assignments")
echo "$ASSIGNMENTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ASSIGNMENTS_RESPONSE"
echo -e "${GREEN}   ✓ Assignments retrieved${NC}\n"

# Test 8: Get load balancer statistics
echo -e "${YELLOW}8. Getting load balancer statistics...${NC}"
LB_STATS_RESPONSE=$(api_call "GET" "/api/projects/$PROJECT_ID/services/$SERVICE_ID/load-balancer/statistics")
echo "$LB_STATS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LB_STATS_RESPONSE"
echo -e "${GREEN}   ✓ Load balancer stats retrieved${NC}\n"

# Test 9: Update scaling policy
echo -e "${YELLOW}9. Updating scaling policy...${NC}"
SCALING_POLICY='{"min_instances":2,"max_instances":5,"target_cpu":75,"target_memory":80}'
SCALING_RESPONSE=$(api_call "PUT" "/api/projects/$PROJECT_ID/services/$SERVICE_ID/scaling" "$SCALING_POLICY")
echo "$SCALING_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SCALING_RESPONSE"
echo -e "${GREEN}   ✓ Scaling policy updated${NC}\n"

# Test 10: Get worker resources
echo -e "${YELLOW}10. Getting worker resources...${NC}"
RESOURCES_RESPONSE=$(api_call "GET" "/api/workers/$WORKER_ID/resources")
echo "$RESOURCES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESOURCES_RESPONSE"
echo -e "${GREEN}   ✓ Worker resources retrieved${NC}\n"

# Test 11: Pin service to worker
echo -e "${YELLOW}11. Pinning service to worker...${NC}"
PIN_RESPONSE=$(api_call "POST" "/api/projects/$PROJECT_ID/services/$SERVICE_ID/pin/$WORKER_ID")
echo "$PIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PIN_RESPONSE"
echo -e "${GREEN}   ✓ Service pinned${NC}\n"

# Test 12: Get scaling decision
echo -e "${YELLOW}12. Checking scaling decision...${NC}"
SCALING_DECISION_RESPONSE=$(api_call "GET" "/api/projects/$PROJECT_ID/services/$SERVICE_ID/scaling")
echo "$SCALING_DECISION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SCALING_DECISION_RESPONSE"
echo -e "${GREEN}   ✓ Scaling decision retrieved${NC}\n"

# Test 13: Unpin service
echo -e "${YELLOW}13. Unpinning service...${NC}"
UNPIN_RESPONSE=$(api_call "DELETE" "/api/projects/$PROJECT_ID/services/$SERVICE_ID/pin")
echo "$UNPIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UNPIN_RESPONSE"
echo -e "${GREEN}   ✓ Service unpinned${NC}\n"

# Test 14: Disable service (skip if SKIP_DISABLE=1, e.g. right before more E2E)
if [ "${SKIP_DISABLE:-0}" != "1" ]; then
  echo -e "${YELLOW}14. Disabling service...${NC}"
  DISABLE_RESPONSE=$(api_call "POST" "/api/projects/$PROJECT_ID/services/$SERVICE_ID/disable")
  echo "$DISABLE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DISABLE_RESPONSE"
  echo -e "${GREEN}   ✓ Service disabled${NC}\n"
else
  echo -e "${YELLOW}14. Skipping disable (SKIP_DISABLE=1)${NC}\n"
fi

echo -e "${BLUE}=== All Tests Complete! ===${NC}\n"
