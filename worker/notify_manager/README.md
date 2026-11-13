# notify_manager (skeleton)

> **W9a:** Merged home for `email_manager`, `sms_manager`, `slack_manager`, and channel-like `push_manager`.  
> **Today:** providers + facade live in `worker/shared/notifyProviders.js` and `worker/shared/notifyFacade.js`. Legacy managers stay registered; the facade **delegates** CRUD to them when `NOTIFY_DELEGATE_LEGACY` is set (default on).

## Planned port / capabilities

- Port: TBD (likely `3118` range; do not collide with existing managers until catalog update).
- Capabilities: `notify`, `transactional`, `alerts`
- API sketch: `/api/v1/channels`, `/api/v1/messages`, `POST /api/v1/messages/:id/send`, `POST /api/v1/test`

## Provider adapters

| Channel | Adapter | Secrets |
|---------|---------|---------|
| email | `EmailProvider` | `SMTP_*` / SES |
| sms | `SmsProvider` | `TWILIO_*` |
| slack | `SlackProvider` | webhook or bot token |
| push | (future) | `FCM_*` |

Use `NOTIFY_USE_MOCK=1` or `MockProvider` in CI — no paid API calls.

## Related docs

- [docs/plans/redundancy_audit.md](../../docs/plans/redundancy_audit.md)
- [docs/plans/observability_alerts.md](../../docs/plans/observability_alerts.md)
