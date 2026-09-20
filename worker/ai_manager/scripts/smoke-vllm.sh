#!/usr/bin/env bash
# Smoke vLLM through ai_manager (status, models, chat).
#
# Usage:
#   export CONDUCTOR_URL=http://127.0.0.1:3300
#   export PROJECT_ID=d57d380d-acfe-49b0-b5a9-ba973892bc8b
#   export APP_TOKEN=...   # icarus app token (not conductor JWT)
#   bash worker/ai_manager/scripts/smoke-vllm.sh
set -euo pipefail

CONDUCTOR="${CONDUCTOR_URL:-http://127.0.0.1:3300}"
PID="${PROJECT_ID:-d57d380d-acfe-49b0-b5a9-ba973892bc8b}"
TOKEN="${APP_TOKEN:-}"
INTEGRATION="${LLM_INTEGRATION:-orin-vllm}"
MODEL="${VLLM_DEFAULT_MODEL:-cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit}"
BASE="${CONDUCTOR}/api/services/ai_manager/api/v1"

if [[ -z "$TOKEN" ]]; then
  echo "[smoke-vllm] APP_TOKEN required" >&2
  exit 1
fi

auth=(-H "Authorization: Bearer ${TOKEN}")

echo "[smoke-vllm] GET /llm/status integration=${INTEGRATION}"
STATUS=$(curl -fsS "${BASE}/llm/status?project_id=${PID}&integration=${INTEGRATION}" "${auth[@]}")
echo "$STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('reachable'), d; print('status ok:', d.get('model_count'), 'models')"

echo "[smoke-vllm] GET /llm/models"
MODELS=$(curl -fsS "${BASE}/llm/models?project_id=${PID}&integration=${INTEGRATION}" "${auth[@]}")
echo "$MODELS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('models:', [m.get('name') for m in d.get('models',[])][:5])"

echo "[smoke-vllm] POST /llm/chat model=${MODEL}"
CHAT=$(curl -fsS -X POST "${BASE}/llm/chat?project_id=${PID}" \
  "${auth[@]}" -H "Content-Type: application/json" \
  -d "{\"model\":\"${MODEL}\",\"integration\":\"${INTEGRATION}\",\"project_id\":\"${PID}\",\"messages\":[{\"role\":\"user\",\"content\":\"Say hi in one word.\"}]}")
echo "$CHAT" | python3 -c "import sys,json; d=json.load(sys.stdin); c=d.get('message',{}).get('content') or (d.get('choices') or [{}])[0].get('message',{}).get('content'); assert c, d; print('chat ok:', c[:80])"

echo "[smoke-vllm] PASS"
