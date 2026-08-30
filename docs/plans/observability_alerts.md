# Observability & alert routing

> **AWS analog:** CloudWatch Alarms → SNS  
> **GCP analog:** Monitoring alert policies → Pub/Sub / webhook  
> **Navigation:** [enterprise_standards.md](./enterprise_standards.md) · [webhook_manager.md](./webhook_manager.md) · [MASTER_TODOS.md](./MASTER_TODOS.md)

---

## Summary

Managers expose `/health` and `/metrics`; conductor aggregates health (cc-health-dash, cc-prometheus). **Gap:** no automated alert routing when things break. Route through **webhook_manager** first (no third-party keys); email/slack when defer-3p keys exist.

---

## Production checklist (cc-alerts-*)

### Alert rules (cc-alerts-1)

- [ ] **cc-alerts-1a** Conductor `AlertService` — evaluate rules on interval (60s)
- [ ] **cc-alerts-1b** Rule: any enabled manager `/health` unhealthy > 5 minutes
- [ ] **cc-alerts-1c** Rule: worker heartbeat missing > 10 minutes
- [ ] **cc-alerts-1d** Rule: updater version drift > 24h (release-fleet-4)
- [ ] **cc-alerts-1e** Rule: conductor disk / SQLite size threshold (optional)
- [ ] **cc-alerts-1f** Dedupe + cooldown (no alert spam)

### Delivery (cc-alerts-2)

- [ ] **cc-alerts-2a** Default delivery: `webhook_manager` POST to project-configured ops endpoint
- [ ] **cc-alerts-2b** Payload schema (AWS EventBridge-style):

```json
{
  "type": "manager.unhealthy",
  "severity": "critical",
  "project_id": "…",
  "manager": "ai_manager",
  "worker": "orin",
  "request_id": "…",
  "runbook": "docs/runbooks/incident.md#manager-down",
  "timestamp": "ISO8601"
}
```

- [ ] **cc-alerts-2c** HMAC signature on outbound alerts (E41 pattern)
- [ ] **cc-alerts-2d** Later: route to email_manager / slack_manager when keys exist

### Console (cc-alerts-3)

- [ ] **cc-alerts-3a** Dashboard Animus banner for active incidents
- [ ] **cc-alerts-3b** Settings: configure ops webhook URL per project
- [ ] **cc-alerts-3c** Alert history table (last 7 days)

### Metrics foundation (ties to cc-prometheus, E45)

- [ ] Prometheus scrape all managers (`/metrics`)
- [ ] Grafana templates (cc-obs-grafana)
- [ ] SLO panel feeds from same RED metrics (E45)

---

## CLI parity

```bash
aerekos alerts rules list --project $PID
aerekos alerts test --project $PID        # send test webhook
aerekos alerts history --project $PID
```

---

## Links

- Cursor todos: `cc-alerts-1` … `cc-alerts-4`, `cc-prometheus`, `cc-health-dash`, `e45`
