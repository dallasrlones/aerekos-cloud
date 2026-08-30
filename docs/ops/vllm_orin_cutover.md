# vLLM on Orin — cutover and rollback

## Cutover (LLM only; embeddings stay on Ollama)

1. Deploy vLLM + ai_manager:
   ```bash
   bash scripts/deploy/deploy.sh ai-vllm
   ```

2. Seed integrations (if not already):
   ```bash
   curl -X POST "$CONDUCTOR/api/services/ai_manager/api/v1/providers/seed-local?project_id=$PID" \
     -H "Authorization: Bearer $APP_TOKEN" -H "Content-Type: application/json" -d '{}'
   ```

3. Smoke vLLM:
   ```bash
   APP_TOKEN=... bash worker/ai_manager/scripts/smoke-vllm.sh
   ```

4. Flip defaults (DB or PATCH):
   - `orin-vllm` → `is_default: true`
   - `orin-ollama` → `is_default: false` (keep enabled for fallback)

5. On Orin `worker/.env` / compose:
   ```bash
   LLM_BACKEND=vllm
   ```

6. Redeploy ai_manager:
   ```bash
   bash scripts/deploy/deploy.sh ai
   ```

7. Update icarus prod-ops (ARN + `LLM_INTEGRATION=orin-vllm`) and redeploy icarus.

8. Stop Ollama **LLM daemon** only (keep running if embeddings still need it):
   ```bash
   sudo systemctl stop ollama
   sudo systemctl disable ollama   # optional
   ```

## Rollback

1. `orin-ollama` → `is_default: true`, `orin-vllm` → `is_default: false`
2. `LLM_BACKEND=ollama` in worker env; redeploy ai_manager
3. `sudo systemctl start ollama`
4. icarus: `LLM_INTEGRATION=orin-ollama`, `AEREKOS_LLM_ARN=.../orin-ollama`
5. Optional: `docker compose -f worker/docker-compose.vllm.yml down`
