#!/bin/bash

# Test script for Conductor API endpoints

echo "=== Starting Conductor Server ==="
cd "$(dirname "$0")"
node index.js > /tmp/conductor-test.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to start..."
sleep 3

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start!"
    cat /tmp/conductor-test.log
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
fi
echo "Token extracted: ${TOKEN:0:50}..."
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

echo "=== Stopping Server ==="
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
echo "✅ Tests completed!"
