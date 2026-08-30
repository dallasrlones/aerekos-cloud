# ai_manager — Embeddings

> **AI** · Vector embeddings via Ollama `/api/embed`.

Uses the same Ollama GPU backend as LLM. Default model: `nomic-embed-text` (override with `EMBEDDING_MODEL`).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/embeddings/status` | Backend + default model |
| `POST` | `/api/v1/embeddings` | `{ model?, input: string \| string[] }` |

## Example

```bash
curl -s -X POST "$CONDUCTOR/api/services/ai_manager/api/v1/embeddings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":"Aerekos cloud private AWS"}'
```

Response includes `embeddings` array (one vector per input string).
