# ADR 001 — One primary conductor

Status: accepted

The control plane is a single SQLite writer (`CONDUCTOR_STORE=sqlite`). Scale-out is workers. Failover is restore + start one process. Multi-conductor HA waits for a non-SQLite store (Edition 2).
