# Mixed compose (prod-mini)

The homelab conductor host does **not** run a single `docker-compose.full.yml`. Mixing stacks is intentional. **Never `deploy.sh full`** on this box unless you intend to replace the running set. **Never `--remove-orphans`** (that kills the other compose’s containers). `deploy.sh full` must not pass `--remove-orphans`. Start missing services with `compose up -d --no-deps`. vLLM only on orin.

## What runs

| Compose file | Project / network | Containers (typical) |
|--------------|-------------------|----------------------|
| `docker-compose.yml` (repo root) | `aerekos-cloud` / `aerekos-cloud_aerekos-cloud-network` | `aerekos-cloud-conductor`, frontend, worker |
| `docker-compose.core.yml` | network `aerekos-cloud_aerekos` (env `AEREKOS_CORE_NETWORK`) | `*_manager` (secrets, storage, key, auth, db, api, …) |

Conductor **also joins** the core managers network:

- Compose: `core_managers` external network
- Alias: **`aerekos-conductor`**
- Internal listen: container port **3000** (host publish is typically **3300**)

Managers whose `CONDUCTOR_URL` is `http://aerekos-conductor:3000` reach this process **only** because of that alias. The live container name is `aerekos-cloud-conductor`, not `aerekos-conductor`.

## extra_hosts

Conductor has:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

`_directServiceRequest` uses published manager ports on the host when DNS for `host.docker.internal` would otherwise ENOTFOUND. Recreate after changing compose — a plain `docker restart` does **not** apply `extra_hosts` or network aliases:

```bash
cd ~/work/aerekos/aerekos-cloud
docker compose -f docker-compose.yml up -d --no-deps --force-recreate conductor
```

Do not recreate the core stack in the same command.

## Proxy auth (Icarus)

Live conductor loads **`conductor/api/routes/services.js`** (bind-mounted), not the older `conductor/api/services.js`.

Generic `/:serviceName/api` and the storage / db_manager proxies use **`appProxyAuth`**:

- Accepts **app JWTs** (auth_manager `verify()`), not only human console JWTs.
- Forwards `Authorization` to the manager.

Without this, Icarus C0 **secrets list** and **storage put** return 401 (human JWT vs app token).

**Do not rebuild `auth_manager` from the Mac tree** unless Mac `worker/auth_manager` still mounts `/api/v1/auth/token` + credentials. Overwriting the live image with a providers-only router breaks C0 token mint.

## Storage uploads

`express.json` strips non-JSON bodies. Conductor **streams** `Content-Type: application/octet-stream` and `multipart/*` to storage_manager. C0 put uses octet-stream. JSON `{ content: "…" }` and `text/plain` are rejected by the files API.

Storage (and db_manager when `AUTH_REQUIRED` is not true) also accept auth_manager app tokens, not only conductor `validate-token` service tokens.

## Slow AI timeout

Embeddings and memory are on the **slow** proxy timeout list (with `/llm/chat`, stt, tts), using `CONDUCTOR_PROXY_TIMEOUT_MS` (default 120s in code, homelab **1800000**). A 10s default 503s Icarus embed on Orin.

## key_manager

Host `:3002` may be a **different** stack (`aerekos_storage_admin`). Conductor must reach **`aerekos-key_manager:3002` on the core network**, not a random host publish. Until the alias existed, key_manager `CONDUCTOR_URL=http://aerekos-conductor:3000` failed to connect (health 500 / bucket 404).

## db_manager / api_manager

Added to `docker-compose.core.yml` for Icarus C4/C8:

- `db_manager` `:3004` — listens even if `PROJECT_ID` is missing when `AUTH_REQUIRED` is not true. Joi create includes `sqlite3` and `lancedb`. Create body must **not** send `project_id` (query only).
- `api_manager` `:3124` — `POST /api/v1/endpoints/seed-presets`. Model columns are `project_id, name, method, public_path, backend_url`; scopes encoded in `backend_url` as `service:path#scope`.

Volumes: `db_manager-data`, `api_manager-data`.

## Worker tags (T65)

Conductor `workers` table: `env` (string, not a prod/dev enum) and `capabilities` (JSON array). `registerWorker` uses `envVal` / `capabilitiesVal` (avoid shadowing). Live register needs the **DB registration token** from `GET /api/token` with admin JWT.

## Recreate vs restart

| Change | Command |
|--------|---------|
| Bind-mounted JS (`routes/services.js`) | `docker restart aerekos-cloud-conductor` |
| `extra_hosts`, networks, alias, env | `docker compose -f docker-compose.yml up -d --no-deps --force-recreate conductor` |
| One manager image | `docker compose -f docker-compose.core.yml up -d --no-deps --build <service>` |
| Full mixed stack | **don’t** — not `deploy.sh full` |

See [deploy.md](deploy.md).
