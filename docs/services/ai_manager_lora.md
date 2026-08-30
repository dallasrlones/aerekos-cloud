# ai_manager — LoRA (T40)

> **AI** · PEFT adapters queued by `ai_manager`, trained on CUDA by `lora_trainer` (oculus).

Not generated from `docs/catalog.js`. Operator runbook: [`../runbooks/lora-gpu.md`](../runbooks/lora-gpu.md).

## Endpoints

All under `{CONDUCTOR}/api/services/ai_manager`. Require app JWT (`appProxyAuth`). `project_id` query (and body for train/attach).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/lora/train` | 201 `{ adapter, job_id, status: "queued" }`. Writes `lora-jobs/<id>/`. |
| `POST` | `/api/v1/lora/attach` | Flag one adapter `attached: true` for the project |
| `GET` | `/api/v1/lora/:id` | Catalog row + job (`queued` / `running` / `completed` / `failed`) |
| `GET` | `/api/v1/lora?project_id=` | List adapters for a project |

Code: `worker/ai_manager/api/routes/lora.js`. Trainer: `worker/ai_manager/jobs/lora_worker.py`.

## Train body

```json
{
  "project_id": "<uuid>",
  "name": "my-adapter",
  "examples": [{ "in": "hi", "out": "hello" }]
}
```

`examples` become JSONL (`in`/`input`, `out`/`output`). Empty examples still train a default “hi/hello” pair so CUDA still runs.

## Status reconcile

`GET` reads `done.json` / `failed.json` on the shared volume and copies `status`, `weights`, `cuda`, `loss`, `error` onto the catalog.

## Live e2e

`e2e/lora-train.js` / `e2e/lora-attach.js` — assert 201 + adapter id; they do **not** wait for `done.json`.
