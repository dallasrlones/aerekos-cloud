# Observability appliance limits (queue / logs / metrics)

Honest GA gate for W6 when production NATS/Loki/Prometheus are not yet required.

## Default (dev / single-node appliance)

| Plane | Default provider | Env | Limit |
|-------|------------------|-----|-------|
| Queue | `LocalNatsStub` (in-memory) or SQLite engines in `queue_manager` | `AEREKOS_QUEUE_PROVIDER=local_nats` | Process-local; lost on restart; not multi-host |
| Logs | Local SQLite / file tail via `logs_manager` | — | Not a cluster log store; retention is local disk |
| Metrics | `/metrics` Prometheus text + local scrape helper | — | Scrape the appliance; no remote-write by default |

See [provider-seams.md](../architecture/provider-seams.md).

## When to graduate

- Multi-worker durable jobs → NATS JetStream (or cloud queue) behind `QueueProvider`
- Central query across hosts → Loki / cloud logs behind `LogProvider`
- Long-term TSDB / alerts → Prometheus + Alertmanager (or AMP/GCM) behind `MetricsProvider`

## Soak (local)

```bash
# queue publish/consume via queue_manager e2e (mock path OK)
# metrics scrape: curl -sf "$CONDUCTOR_URL/api/services/metrics_manager/metrics" | head
# restore drill (SoR): docs/runbooks/conductor-restore-drill.md
```

SQLite / LocalNatsStub are **supported appliance backends**, not silent stand-ins for cloud HA.
