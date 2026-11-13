# auth_manager — port detection vs listen order

> **When to read:** Conductor proxy hits `auth_manager` on the wrong port; registration shows `3127` but Docker publishes `3116`; health works on one port and fails on another.

## What happens

Many legacy managers call `detectAvailablePort()` inside `registerWithConductor()` **after** `app.listen(PORT)` already bound `PORT` from env (fixed in compose as `3116:3116`).

For `auth_manager` (`worker/auth_manager/index.js`):

1. Process listens on `process.env.PORT` (e.g. **3116**).
2. Registration runs `detectAvailablePort(3116)` which probes bind availability **again**.
3. If something else briefly held the port during probe, or probe logic increments, registry may record **3117** while the process still serves **3116**.

Symptoms match [ai_manager README](../../worker/ai_manager/README.md): log line `Port 3126 in use, trying 3127` with host publish still on `3126`.

## Expected fix (not a one-liner today)

1. **Detect before listen** — `const port = await detectAvailablePort(basePort);` then `app.listen(port)` and set `process.env.PORT = String(port)`.
2. **Register the bound port** — in `serviceRegistration.js`, use the same port the server listens on (skip re-probe when `process.env.PORT` is already set post-listen, or pass `server.address().port`).

`auth_manager` has not been migrated to `createManagerApp` listen helper yet; a proper fix touches `index.js` + `api/utils/serviceRegistration.js` (async bootstrap).

## Workarounds

| Scenario | Action |
|----------|--------|
| Docker compose | Keep fixed `PORT=3116`; set `SKIP_SERVICE_REGISTRATION=true` only in isolated tests, not prod |
| Wrong registry port | Re-register after ensuring single listener: restart container, confirm `curl localhost:3116/health` |
| Conductor proxy 502 | Check `GET /api/services/auth_manager` registry port vs `docker port aerekos-auth_manager` |
| Local multi-manager dev | Stop duplicate auth_manager processes or assign unique `PORT` before start |

## Verification

```bash
docker port aerekos-auth_manager 3116
curl -sf http://127.0.0.1:3116/health | jq .
# Compare to conductor registry (admin UI or API services list)
```

## Related

- [auth-required.md](./auth-required.md) — `AUTH_MANAGER_URL` on conductor
- [identity.md](../architecture/identity.md) — app credential verify path
