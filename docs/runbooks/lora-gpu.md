# GPU LoRA trainer (oculus)

Icarus T40 live e2e (`e2e/lora-train.js`, `e2e/lora-attach.js`) hits `ai_manager` LoRA HTTP. Weights are trained by a **separate** container `aerekos-lora_trainer`, not inside the running vLLM process.

**Do not restart a healthy vLLM** to ship LoRA. Do not `docker compose` the vLLM file as a side effect of `ai`.

## Pieces

| Piece | Where | Role |
|-------|--------|------|
| HTTP catalog | `worker/ai_manager/api/routes/lora.js` | `POST /train` queues a job, `POST /attach` flags an adapter, `GET /` and `GET /:id` reconcile disk status |
| Job files | volume `aerekos-ai_ai_manager-data` → `/data/lora-jobs/<id>/` | `examples.jsonl`, `queued.json`, `running.json`, `done.json` / `failed.json`, `adapter/` |
| Worker | `worker/ai_manager/jobs/lora_worker.py` | Consumes `lora-inbox` (AMQP via `pika` in `LORA_PIP_DIR`) and still polls disk if RabbitMQ is down; PEFT on **CUDA** |
| Compose | `worker/docker-compose.ai.yml` service `lora_trainer` | Image `ghcr.io/nvidia-ai-iot/vllm:latest-jetson-orin` (same as vLLM — already has CUDA torch + transformers). `runtime: nvidia`. Project `-p aerekos-ai` |

`POST /train` returns **201** with `status: queued` immediately so C5 e2e does not wait for GPU.

## Job directory

```
/data/lora-jobs/<lora-…>/
  examples.jsonl
  queued.json          # id, name, project_id, base, steps
  running.json         # present while a step is in flight
  done.json            # ok, cuda, device, loss, seconds, out, target_modules
  failed.json          # error + traceback
  adapter/             # adapter_model.safetensors, adapter_config.json, tokenizer
```

`ai_manager` catalog file: `/app/ai_manager/data/lora-adapters.json` (same volume).

## Env (trainer)

| Variable | Default | Meaning |
|----------|---------|---------|
| `LORA_BASE_MODEL` | `sshleifer/tiny-gpt2` | HF id — small on purpose so it fits next to vLLM |
| `LORA_MAX_STEPS` | `8` | AdamW steps |
| `LORA_POLL_S` | `2` | Watch interval |
| `LORA_JOBS_DIR` | `/data/lora-jobs` | |
| `LORA_PIP_DIR` | `/data/lora-pip` | `pip install --no-deps peft pyyaml` only (vLLM image already has torch/transformers) |
| `HF_HOME` | HuggingFace cache bind | |

**Do not** `pip install peft` without `--no-deps` — it will pull a second torch (~233MB) and can shadow CUDA.

On startup the worker deletes stale `running.json` (crash recovery). CUDA OOM / NVML errors retry up to 3 times; `empty_cache()` after each job. Overlapping trains while vLLM is loaded can still fail (`NvMapMemAlloc` error 12) — serialize jobs.

## Deploy (Mac → oculus)

```bash
# Mac
SYNC_CONFIRM=yes bash scripts/deploy/push-to-host.sh oculus

# oculus — ai_manager image if lora.js changed; trainer is bind-mount scripts
ssh oculus 'cd ~/work/aerekos/aerekos-cloud && \
  docker compose -p aerekos-ai -f worker/docker-compose.ai.yml up -d --no-deps --build ai_manager && \
  docker compose -p aerekos-ai -f worker/docker-compose.ai.yml up -d --no-deps lora_trainer'
```

`--force-recreate lora_trainer` after editing `lora_worker.py` (bind mount is enough if the process restarts). Leave `aerekos-vllm` untouched.

`multer` is an `ai_manager` dependency so `/stt` mounts (see [../services/ai_manager_stt.md](../services/ai_manager_stt.md)). Rebuild ai_manager after `package.json` changes. Keep the named volume.

## Prove a GPU job

After `POST .../lora/train` (app token + `project_id` query):

```bash
docker logs -f aerekos-lora_trainer
# expect: watching … then start <id> then done <id> loss=… s=…
```

`done.json` should include `"cuda": true`, `"device": "Orin"`. Weights: `adapter/adapter_model.safetensors`.

Live HTTP e2e (does not wait for `done.json`):

```bash
node e2e/lora-train.js
node e2e/lora-attach.js
```

`POST /train` also publishes `{ job_id }` to `lora-inbox` (`engine: rabbitmq`). If a chat job is `running`, train returns **409**. `pika` is pip-installed into `LORA_PIP_DIR` — it is not in the Jetson vLLM image.

## Attach vs chat

Attach only sets `attached: true` on the catalog row (and path to weights). Loading the adapter into Ollama/vLLM generate is **not** wired in this pass. Raising `LORA_BASE_MODEL` to a real instruct model is a follow-up (GPU memory vs vLLM `--gpu-memory-utilization`).

## First successful homelab run

tiny-gpt2, 8 steps, ~1.3s on Orin after HF download, loss ~10.82, `target_modules: ["c_attn"]`. vLLM stayed up.
