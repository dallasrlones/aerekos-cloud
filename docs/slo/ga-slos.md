# GA SLO placeholders (measure before commit)

These are **draft targets** for General Availability. Replace placeholders with values from Prometheus / access logs after two weeks of prod-like load. Until then, use them as alert wiring stubs only.

## Scope

| Surface | What users feel | Metric source (today) |
|---------|-----------------|-------------------------|
| Conductor proxy | Manager API latency via conductor | `aerekos_conductor_http_requests_total` + ingress logs |
| Storage manager | Put/get/list via proxy | `aerekos_storage_manager_http_requests_total` |
| Auth / health | Login and fleet attach | conductor `/health`, auth routes |

## Latency (p99) — placeholders

| Route class | p99 target | Error budget (monthly) | Notes |
|-------------|------------|------------------------|-------|
| Conductor proxy — read (`GET` manager APIs) | **800 ms** | 0.1% 5xx | Excludes long-poll / WS |
| Conductor proxy — write (`POST`/`PUT`/`PATCH`) | **2.5 s** | 0.5% 5xx | Includes fan-out to one worker |
| Storage manager — `PUT` object | **3 s** | 0.5% 5xx | Local disk backend; raise for multi-AZ |
| Storage manager — `GET` object | **1.2 s** | 0.1% 5xx | First byte; large objects separate SLI |
| Conductor — `GET /health` | **150 ms** | 0.01% fail | Synthetic every 30s |

## Availability — placeholders

| Service | Target uptime | Measurement window |
|---------|---------------|-------------------|
| Conductor API (external) | **99.5%** | 30d rolling |
| Storage manager (per project) | **99.5%** | 30d rolling |
| Worker agent heartbeat path | **99.0%** | 30d rolling |

Single-node SQLite conductor: availability SLO is **honest-cap** by backup/RTO in [conductor-ha.md](../runbooks/conductor-ha.md), not by multi-AZ magic.

## Correlation

- **Request id:** `X-Request-Id` on conductor and managers (`worker/shared/requestId.js`).
- **Trace (optional):** `AEREKOS_OTEL_TRACE=1` propagates W3C `traceparent` (`worker/shared/otelTrace.js`). Full OpenTelemetry SDK export is post-GA (`docs/plans/MASTER_TODOS.md` → `cc-obs-otel`).

## Review cadence

1. Export p50/p95/p99 from metrics or load test (`e2e/icarus-platform-matrix.js` bench hooks).
2. Compare to table above; update targets and wire alerts in `metrics_manager` / external Grafana.
3. Record decision in release notes when promoting placeholder → committed SLO.
