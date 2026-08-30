# queue_manager — SQS

> **Compute** · Implemented

Message queues: create queues, send/receive/delete messages, visibility timeouts.

- **Port:** `3101`
- **AWS analog:** SQS
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/queue_manager{path}` (JWT or service token)
- **Capabilities:** `queues`, `messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/queues` | Create a queue |
| `GET` | `/api/v1/queues` | List queues |
| `GET` | `/api/v1/queues/:name` | Get a queue |
| `DELETE` | `/api/v1/queues/:name` | Delete a queue |
| `POST` | `/api/v1/queues/:name/messages` | Send a message |
| `POST` | `/api/v1/queues/:name/messages/receive` | Receive messages |
| `DELETE` | `/api/v1/queues/:name/messages/:messageId` | Delete (ack) a message |
| `POST` | `/api/v1/queues/:name/messages/:messageId/visibility` | Change visibility |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/queue_manager/api/v1/queues?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('queue_manager', { method: 'POST', path: '/api/v1/queues', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call queue_manager POST "/api/v1/queues" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
