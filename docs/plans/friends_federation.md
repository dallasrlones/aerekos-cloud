# Friends federation (Phase 2) — Preview

**Maturity:** Preview. Same-conductor Friends (Phase 1) is GA.

## Goal

Link two (or more) conductors so a selected project can be **attached** for collab — without multi-writer HA.

## Non-goals

- Does **not** change [ADR 001](../adr/001-one-primary-conductor.md): each conductor keeps one SQLite writer.
- No full workspace/file mirror.
- No shared pins/rolls dump across conductors.
- Federation ≠ hot standby (that is E46).

## Shape

1. **Peer identity** — each conductor has a stable Ed25519 keypair (`PeerIdentityService`); public peer card via `GET /api/federation/peer`.
2. **Signed grant** — home mints EdDSA JWT (`POST /api/projects/:id/federation/grants`); remote trusts peer card then `POST /api/federation/attach`.
3. **Remote project attach** — UI Friends → Federation tab; reads go to home via proxy (`GET /api/federation/attaches/:id/project`). Jobs run on home workers.
4. **Status**: `connecting` · `active` · `degraded` · `disconnected` (`GET .../status`).

## Status mapping

| State | Meaning |
|-------|---------|
| connecting | Handshake / invite accept in flight |
| active | Peer reachable; grant valid |
| degraded | Peer up but live/graph lag or auth refresh failing |
| disconnected | Peer unreachable or grant revoked/expired |

## Deploy

Federation routes ship in the **baked** conductor image. After code changes: rebuild/restart conductor per [docker-compose.core.yml](../../docker-compose.core.yml). Frontend remains host bind-mount.

## OpenAPI

See [conductor_federation.yaml](../openapi/conductor_federation.yaml).
