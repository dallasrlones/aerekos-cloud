# E2E — notify_manager

## Automated (local)

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

## Live conductor/proxy — parked

Not run in this Wave 6 closeout. Blockers:

1. Needs a running conductor + enabled `notify_manager` (port `3154`) on a **non-prod** project.
2. Live send needs channel secrets (SMTP / Twilio / Slack / FCM); without them send stays mock/queue-only (`NOTIFY_USE_MOCK` / missing keys).
3. Root `e2e/wave-notify.js` still exercises legacy `email_manager` / `sms_manager` / `slack_manager` / `push_manager` — not yet pointed at `notify_manager`.

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist (when unparked)

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `notify_manager`; proxy `/api/services/notify_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create message → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/messages/:id/send` returns mock/queue-only without secrets; live send only with keys
- [ ] **E2E-5:** `POST …/test` + SDK/CLI against a non-prod project

## Local smoke

```bash
cd worker/notify_manager
npm test
```
