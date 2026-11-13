# aerekos-sdk & CLI — production plan

**Package:** `aerekos-sdk/` · **CLI:** `aerekos-sdk/bin/aerekos.js`

**Navigation:** [Index](./README.md) · [enterprise_standards.md](./enterprise_standards.md) · Depends on: [platform_app_access.md](./platform_app_access.md)

---

## Summary

Node SDK and CLI for conductor + catalog-driven manager accessors. **Every console action must have a CLI equivalent** — see [enterprise_standards.md § Three surfaces](./enterprise_standards.md#the-three-surfaces-every-resource-every-action).

## Current state

| Area | Status |
|------|--------|
| Catalog sync | `managers.generated.js` from `docs/catalog.js` |
| Manager accessors | `aerekos {manager} {segment} list|create|get|…` |
| Generic proxy | `aerekos call {manager} {METHOD} {path}` |
| Config | `~/.aerekos/config.json` (mode 0600) |
| App credentials | **Not implemented** |
| Shell completion | **Not implemented** |
| OpenAPI-driven types | **Not implemented** |

---

## CLI command map (target)

### Global

```bash
aerekos login --url https://cloudapi.aerekos.com -u admin -p '…'
aerekos whoami
aerekos logout
aerekos config set project <uuid>
aerekos config set url <url>
```

### App access (after platform_app_access P1)

```bash
aerekos cred create --project $PID --name my-app \
  --resources 'arn:aerekos:…:ai:llm:endpoint/prod' \
  --scopes ai:InvokeLlm

aerekos cred list --project $PID
aerekos cred rotate <cred_id>
aerekos cred revoke <cred_id>

aerekos token --client-id cred_xxx --client-secret '…'   # client_credentials

# Icarus console is /icarus (Chat · Fleet · Models · Apps). SDK still uses service name ai_manager.
# Example: chat with the project friend agent, then poll messages / subscribe ai:live:{projectId}.
aerekos invoke ai_manager \
  --resource 'arn:aerekos:…:ai:llm:endpoint/prod' \
  --path /api/v1/llm/chat \
  --data '{"model":"llama3.2:3b","messages":[…]}'
```

### Per-manager (catalog-driven — extend)

```bash
aerekos ai_manager endpoints list --project $PID
aerekos ai_manager endpoints create --project $PID --data '{…}'
aerekos ai_manager endpoints test <id>
aerekos storage_manager buckets list --project $PID
aerekos git_manager repos create --project $PID --data '{"name":"my-app"}'
aerekos services enable ai_manager --project $PID
aerekos search "llm" --project $PID    # global search (parity with console palette)
aerekos health --project $PID          # all enabled managers
aerekos e2e smoke --tier 4             # operator smoke
```

### Ergonomics

```bash
aerekos completion bash >> ~/.bashrc
aerekos setup ai_manager --project $PID    # full service setup wizard (deps + first resource)
aerekos setup ai_manager --status --project $PID
aerekos setup graph                        # dependency enable order
aerekos vpc status                         # Headscale mesh health
aerekos vpc nodes --project $PID
aerekos wizard endpoint               # shortcut: AI endpoint + cred only
aerekos info ai_manager --project $PID  # capabilities, scopes, example curl
```

---

## Production tasks

### Phase A — App auth (blocks app developers)

- [ ] `client.auth.getAppToken({ client_id, client_secret, scope? })`
- [ ] `client.auth.createCredential(...)` — admin JWT
- [ ] `client.invoke(manager, { resource, method, path, body })`
- [ ] CLI: `cred`, `token`, `invoke` commands
- [ ] Exit codes: 0 / 1 / 2 / 3 per enterprise_standards

### Phase B — Catalog-driven CLI parity

- [ ] Add `tier`, `cliParity`, `appScopes` to `docs/catalog.js`
- [ ] Generate `aerekos {mgr} {resource} test` when catalog has test endpoint
- [ ] `aerekos --help` lists all managers with tier badge
- [ ] `aerekos info {manager}` — endpoints, scopes, ARNs, example commands
- [ ] Validate CLI coverage in CI: catalog `cliParity: complete` requires help text

### Phase C — Developer experience

- [ ] `aerekos completion bash|zsh` from catalog
- [ ] `aerekos wizard endpoint` — guided endpoint + credential + test invoke
- [ ] TypeScript types from OpenAPI (`docs/openapi/`)
- [ ] `docs/site/` — CLI tab per service (alongside curl/SDK)
- [ ] Console emits same command string as "Copy CLI" (E23)

### Phase D — Testing

- [ ] e2e Tier 6: CLI `cred create` → `token` → `invoke` → 200
- [ ] e2e Tier 7: parity smoke — pick 5 managers, CLI create/list/delete matches API
- [ ] Document in `aerekos-sdk/README.md` with cloud.aerekos.com examples

---

## SDK surface (Node)

```js
const { AerekosClient } = require('aerekos-sdk');

const admin = new AerekosClient({ baseUrl, token: userJwt });
await admin.auth.createCredential({ projectId, name, allowedResources, scopes });

const app = new AerekosClient({ baseUrl });
const { access_token } = await app.auth.getAppToken({ clientId, clientSecret });
app.setToken(access_token);
await app.invoke('ai_manager', {
  resource: 'arn:aerekos:…',
  method: 'POST',
  path: '/api/v1/llm/chat',
  body: { model, messages },
});
```

---

## Links

- [aerekos-sdk/README.md](../../aerekos-sdk/README.md)
- [enterprise_standards.md](./enterprise_standards.md)
- [e2e/run.js](../../e2e/run.js)
