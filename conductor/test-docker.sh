#!/bin/bash

# Test script for Conductor API endpoints using Docker

set -e

echo "=== Building Docker Image ==="
cd "$(dirname "$0")"
docker-compose build

echo ""
echo "=== Starting Conductor Container ==="
docker-compose up -d

echo ""
echo "Waiting for server to start..."
sleep 5

# Check if container is running
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Container failed to start!"
    docker-compose logs
    exit 1
fi

echo ""
echo "=== Test 1: Health Check ==="
curl -s http://localhost:3000/health | jq . || curl -s http://localhost:3000/health
echo ""

echo "=== Test 2: API Info ==="
curl -s http://localhost:3000/api | jq . || curl -s http://localhost:3000/api
echo ""

echo "=== Test 3: Login (Success) ==="
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN_RESPONSE" | jq . || echo "$LOGIN_RESPONSE"
echo ""

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
    echo "❌ Failed to extract token from login response"
    TOKEN="invalid"
else
    echo "Token extracted: ${TOKEN:0:50}..."
fi
echo ""

echo "=== Test 4: Login (Invalid Credentials) ==="
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}' | jq . || \
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}'
echo ""

echo "=== Test 5: Get Current User (Protected) ==="
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq . || \
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "=== Test 6: Get Current User (No Token) ==="
curl -s http://localhost:3000/api/auth/me | jq . || curl -s http://localhost:3000/api/auth/me
echo ""

echo "=== Test 7: Get Registration Token (Protected) ==="
curl -s http://localhost:3000/api/token \
  -H "Authorization: Bearer $TOKEN" | jq . || \
curl -s http://localhost:3000/api/token \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "=== Test 8: Regenerate Registration Token (Protected) ==="
curl -s -X POST http://localhost:3000/api/token/regenerate \
  -H "Authorization: Bearer $TOKEN" | jq . || \
curl -s -X POST http://localhost:3000/api/token/regenerate \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "=== Test 9: Get New Registration Token ==="
curl -s http://localhost:3000/api/token \
  -H "Authorization: Bearer $TOKEN" | jq . || \
curl -s http://localhost:3000/api/token \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo ""
echo "=== Container Logs ==="
docker-compose logs --tail=20

echo ""
echo "=== Stopping Container ==="
docker-compose down
echo "✅ Docker tests completed!"
