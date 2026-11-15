# E2E tests — Queue Manager

## Automated (Jest)

```bash
cd worker/queue_manager
npm run test:e2e
# or: npm test  (includes tests/e2e/*.test.js)
```

`queueFlow.test.js` runs the real Express app in-process (SQLite, `SKIP_BROKER=1`): health, create/send/receive/ack/delete, and asserts queues are **not** auto-created (including `capacity-wait`).

## Live stack (manual / CI job)

- **E2E-live-1:** Start `queue_manager` container; `GET /health` on the Docker network returns 200.
- **E2E-live-2:** Conductor proxy `/api/services/queue_manager/api/v1/...` with JWT or service token.
- **E2E-live-3:** RabbitMQ / Redis engines only when `SKIP_BROKER` is unset and brokers are up (`RABBITMQ_URL` / `REDIS_URL`).

## Parked: capacity-wait UI noise

Conductor `SystemHome` may `GET .../queues/capacity-wait/messages`. This manager does **not** seed `capacity-wait`, and there is **no** `GET .../messages` route (receive is `POST .../messages/receive`). Treat 404s as a conductor UI / product gap — not a queue_manager create obligation.
