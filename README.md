# aerekos-cloud

> **Self-hosted local AWS for home labs and small teams.** A conductor-worker control plane with
> an extensible service-manager architecture (KMS, S3-like storage, databases, queues, schedules,
> Cloudflare DNS / tunnels, secrets, IAM, logs, metrics, more) — all running in Docker on your
> own hardware.

**Source of truth** for this fleet is the maintainer MacBook checkout. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/runbooks/README.md`](docs/runbooks/README.md) (deploy, mixed stack, Icarus C0–C8, GPU LoRA).

Icarus **agents** live in this repo (AI Manager → Agents). The sister `icarus-agent` tree is the older standalone beta — do not vendor it as a submodule. Runbook: [`docs/runbooks/icarus-agents.md`](docs/runbooks/icarus-agents.md). Fleet smokes: [`docs/runbooks/icarus-c0.md`](docs/runbooks/icarus-c0.md).

## Status — v0.1.0 (GA appliance)

Tagged **`v0.1.0`**. Public mirrors: `scripts/oss/pack-mirror.sh`. Compute = **aerekos Compute** (our Kubernetes-class orchestrator; ADR 004). Checklist: [`docs/GA_CHECKLIST.md`](docs/GA_CHECKLIST.md).


aerekos-cloud is **pre-release**. The control plane (conductor + worker agent) and the foundation
services (`key_manager`, `storage_manager`, `db_manager`, `queue_manager`, `secrets_manager`,
`logs_manager`, `iam_manager`, plus Cloudflare `domain_manager` / `tunnel_manager`) are
implemented and tested. Many additional manager services are scaffolded as **MVP** (working
SQLite-backed CRUD APIs that need real provider keys to be production-useful — e.g. SMTP for
`email_manager`, LLM keys for `ai_manager`, CI runners for `cicd_manager`). See
[`worker/MANAGER_SERVICES.md`](worker/MANAGER_SERVICES.md) for the per-service status table.

This is **not yet** a recommended replacement for cloud providers in production. It **is** a
working, testable, self-hosted spine you can build on. See
[`PRODUCTION.md`](PRODUCTION.md) before any shared deployment.

**This pass:** backups land in object storage (`aerekos-backups`), IaC/edge show a hookup banner,
host OS/Docker check+update is always-on per device, and GraphQL/search/quota are real. Email /
SMS / Slack / push **queue only** (outbound send disabled). Default `admin`/`admin` seeds only
when `ALLOW_DEFAULT_ADMIN_SEED=1`. Dummy JWT / master-key values refuse to boot when
`NODE_ENV=production`. Mixed-stack hosts must never use `--remove-orphans` or `deploy.sh full`.

## Overview

aerekos-cloud provides a self-hosted, containerized cloud platform where:
- **Conductor** acts as the master orchestrator, managing all workers and services
- **Workers** are slave devices that host and run services
- **Services** are containerized applications that can be dynamically deployed across workers
- Everything runs locally using Docker and Docker Compose

## Architecture

### Components

#### Conductor
The conductor is the central control plane of aerekos-cloud:
- **Primary API**: Serves as the main API endpoint for all third-party applications
- **Worker Management**: Handles worker registration, discovery, and health monitoring
- **Service Orchestration**: Manages service lifecycle, deployment, and routing
- **Resource Management**: Tracks and allocates resources across workers
- **Frontend**: React Native dashboard for managing the entire infrastructure
- **Database**: Uses SQLite (via `aerekos-record`) to store all state

#### Workers
Workers are devices that host and run services:
- **Self-Registration**: Automatically register with conductor using token and IP
- **Resource Reporting**: Report available resources (CPU, RAM, disk, network)
- **Container Execution**: Run Docker containers as instructed by conductor
- **Heartbeat**: Maintain connection with conductor via periodic heartbeats
- **Resilience**: Automatically re-register after power outages or IP changes

#### Services
Services are the applications provided by aerekos-cloud:
- **Modular**: Each service lives in its own folder under `worker/`
- **Containerized**: Each service has its own `docker-compose.yml`
- **API-enabled**: Each service exposes its own API
- **Orchestrated**: Services communicate with conductor for coordination
- **Dynamic**: Can be enabled/disabled and deployed across workers on demand

### Data Flow

```
Third-Party Apps → Conductor API → Service APIs → Workers → Docker Containers
                                    ↓
                              SQLite Database
```

1. Third-party applications make requests to the Conductor API
2. Conductor routes requests to appropriate service APIs
3. Service APIs communicate with conductor for coordination
4. Conductor orchestrates deployment and manages workers
5. Workers execute Docker containers for services

## Features

- 🎯 **Self-Hosted**: Complete local control over your infrastructure
- 🔄 **Dynamic Orchestration**: Automatically deploy services to optimal workers
- 📊 **Resource Management**: Intelligent worker selection based on available resources
- 🔌 **Self-Registration**: Workers automatically register and recover from failures
- 🐳 **Docker-Native**: Everything runs in containers for easy deployment
- 📱 **React Native Dashboard**: Manage everything from a mobile-friendly interface
- 🔐 **Token-Based Security**: Secure worker registration and communication
- 📈 **Scalable**: Add workers dynamically to scale your infrastructure

## Project Structure

```
aerekos-cloud/
├── conductor/             # Conductor service (master)
│   ├── index.js          # Conductor API server
│   ├── docker-compose.yml # Conductor + Frontend docker-compose
│   ├── Dockerfile.dev     # Development Dockerfile
│   └── .env_example       # Conductor environment variables
├── worker/                # Worker (slave)
│   ├── index.js          # Worker registration client
│   ├── docker-compose.yml # Primary worker container docker-compose
│   ├── Dockerfile.dev     # Development Dockerfile
│   ├── .env_example       # Worker environment variables
│   └── [service_name]/   # Individual services (each has own docker-compose.yml)
│       ├── docker-compose.yml # Service-specific docker-compose
│       └── ...
├── services/              # Optional shared tooling (ORM is npm: `aerekos-record`)
├── aerekos-sdk/          # SDK for third-party integrations
├── README.md             # This file
├── DOCKER.md             # Docker setup guide
├── TESTING.md            # Testing guide
└── plan.md               # Implementation plan
```

## Quick Start (Docker Compose - Recommended)

### One command: the entire platform

Bring up the conductor, dashboard, worker agent, **and every manager service** with a
single command. The full stack is described by `docker-compose.full.yml`, which is
generated from the canonical port map (`conductor/api/config/managerServicePorts.js`).

```bash
make up        # build + start all 36 services (detached)
make health    # status of every container
make logs      # tail logs for the whole stack
make down      # stop everything
```

- Conductor API : http://localhost:3000  (login with a real user; default `admin`/`admin` only if `ALLOW_DEFAULT_ADMIN_SEED=1`)
- Dashboard      : http://localhost:19006
- Each manager   : http://localhost:<port> (see `docker-compose.full.yml`)

**Port already in use?** Override the host ports without editing files:

```bash
CONDUCTOR_PORT=3300 FRONTEND_PORT=19610 WORKER_PORT=3001 \
  docker compose -f docker-compose.full.yml up -d --build
```

**Regenerate** the compose file / Dockerfiles after adding a manager:

```bash
make gen       # runs the Dockerfile + full-stack compose generators
```

> Note: manager images run on `node:20-bookworm-slim` and re-fetch the Linux
> `better-sqlite3` prebuild at build time (`npm rebuild better-sqlite3`), because the
> `aerekos-record` npm package bundles a macOS binary that cannot load on Linux.

### Prerequisites

- Docker and Docker Compose
- Network access for ports 3000, 3001, 19006 (override as shown above if taken)

### Complete Setup (All Services)

1. **Clone and setup**
   ```bash
   cd aerekos-cloud
   cp .env_example .env
   
   # Setup conductor .env
   cd conductor
   cp .env_example .env
   # Edit .env with JWT_SECRET
   cd ..
   ```

2. **Start conductor and frontend**
   ```bash
   docker-compose up --build
   ```

3. **Get registration token**
   - Open http://localhost:19006 in browser
   - Login: `admin` / `admin`
   - Go to Settings → View registration token
   - Copy token

4. **Configure and start worker**
   ```bash
   # Add WORKER_TOKEN=<your-token> to root .env
   # Then start worker
   docker-compose up -d worker
   ```

5. **Verify registration**
   - Check http://localhost:19006/devices
   - Worker should appear with status "online"

**All services are now running:**
- Conductor API: http://localhost:3000
- Frontend: http://localhost:19006
- Worker API: http://localhost:3001

See [DOCKER.md](./DOCKER.md) for detailed Docker setup instructions.

### Alternative: Local Development

If you prefer to run services locally (without Docker):

**Conductor:**
```bash
cd conductor
npm install
cp .env_example .env
npm start
```

**Worker:**
```bash
cd worker
npm install
cp .env_example .env
# Edit .env with CONDUCTOR_URL and CONDUCTOR_TOKEN
npm start
```

### Service Management

1. **List available services**
   ```bash
   curl http://localhost:3000/api/services
   ```

2. **Enable a service**
   ```bash
   curl -X POST http://localhost:3000/api/services/ai_manager/enable
   ```

3. **View service deployments**
   ```bash
   curl http://localhost:3000/api/services/ai_manager/deployments
   ```

## API Endpoints

### Conductor API

#### Worker Management
- `GET /api/workers` - List all workers
- `GET /api/workers/:id` - Get worker details
- `POST /api/workers/register` - Register a new worker
- `POST /api/workers/:id/heartbeat` - Worker heartbeat
- `GET /api/resources` - Get aggregated resource information

#### Service Management
- `GET /api/services` - List all services
- `GET /api/services/:name` - Get service details
- `POST /api/services/:name/enable` - Enable a service
- `POST /api/services/:name/disable` - Disable a service
- `GET /api/services/:name/deployments` - Get service deployments
- `POST /api/services/:name/deploy` - Deploy service to workers

#### Authentication
- `POST /api/auth/login` - User login (username, password) - returns JWT token
- `GET /api/auth/me` - Get current user info (requires JWT authentication)

#### Token Management
- `GET /api/token` - Get current registration token (requires authentication)
- `POST /api/token/regenerate` - Generate new token (requires authentication)

### Service APIs (proxied through the conductor)

Clients should reach services through the **conductor proxy**, not directly. Pattern:

```
{any HTTP verb} {CONDUCTOR}/api/services/{serviceName}/api/{service-internal path}
```

#### Key Manager (KMS) — examples
- `POST   /api/services/key_manager/api/keys` — Create encryption key
- `GET    /api/services/key_manager/api/keys/:name` — Get key (decrypted material in body)
- `POST   /api/services/key_manager/api/keys/:name/rotate` — Rotate

#### Storage Manager (S3-like) — examples
- `POST   /api/services/storage_manager/api/buckets` — Create bucket
- `GET    /api/services/storage_manager/api/buckets` — List buckets
- `POST   /api/services/storage_manager/api/buckets/:name/objects` — Upload
- `GET    /api/services/storage_manager/api/buckets/:name/objects/:key` — Download

For the full mental model (auth, signed paths, db_manager JWT forwarding, health, metrics,
batch logs ingest), see [`GOLDEN_PATH.md`](GOLDEN_PATH.md) §5. Path mapping lives in
[`conductor/api/utils/buildServiceProxyPath.js`](conductor/api/utils/buildServiceProxyPath.js).

## SDK

[`aerekos-sdk`](aerekos-sdk/README.md) is a dependency-free JavaScript/TypeScript client
(uses the global `fetch`, Node 18+):

```js
const { AerekosClient } = require('aerekos-sdk');
const client = new AerekosClient({ baseUrl: 'http://localhost:3000' });
await client.auth.login('admin', 'admin');

const services = await client.services.list();
await client.keys.create('p-123', { name: 'app-key', type: 'symmetric', algorithm: 'aes-256-gcm' });
const buckets = await client.storage.listBuckets('p-123');

// generic proxy to any manager
await client.proxy('queue_manager', { path: '/api/v1/queues', projectId: 'p-123' });
```

The SDK also ships a **catalog of all 34 managers** and catalog-driven accessors so you can
reach any service without a hand-written helper:

```js
const series = client.resource('metrics_manager', 'series');
await series.create('p-123', { name: 'cpu', metric_name: 'cpu', value: '0.4', labels: '{}' });

await client.svc.git_manager.resource('repos').create('p-123', { name: 'hello' });
console.log(await client.svc.git_manager.metrics('p-123')); // raw Prometheus text
```

### CLI

Installing the SDK globally provides the `aerekos` command:

```bash
npm install -g aerekos-sdk
aerekos login --url http://localhost:3000 -u admin -p admin
aerekos managers                                   # the whole catalog
aerekos git_manager repos create -P demo -d '{"name":"hello"}'
aerekos call key_manager POST /api/keys -P demo -d '{"name":"k","type":"symmetric"}'
```

## Documentation

Every service is documented from a single source of truth, [`docs/catalog.js`](docs/catalog.js):

- **Per-service reference:** [`docs/services/`](docs/services/) (one page per service + an index) — run `make docs` to (re)generate.
- **Web docs:** a self-contained, searchable site at `docs/site/index.html`. Serve locally with `make docs-serve` (http://localhost:8080), or run it in the stack — `make gen && make up` starts an `aerekos-docs` container (`DOCS_PORT`, default 8080).

```bash
make docs         # generate docs/services/*.md, docs/site/, and the SDK manager table
make docs-serve   # preview the web docs at http://localhost:8080
```

## Provider activation (bring your own keys)

Several managers are complete control-plane services (full CRUD + SQLite + tests) whose
*external* actions light up once you provide credentials. Until then they run fully and
degrade gracefully. Configure via each service's environment / `secrets_manager`:

| Manager | Activates with |
|---------|----------------|
| `email_manager` | SMTP / email-API credentials |
| `sms_manager` | SMS provider (e.g. Twilio) token |
| `slack_manager` | Slack bot/webhook token |
| `ai_manager` | LLM endpoint + key (Ollama URL or OpenAI-compatible) |
| `cicd_manager` | CI runner / repo tokens |
| `domain_manager`, `tunnel_manager` | Cloudflare API token |

## Database Models

The conductor uses SQLite (via `aerekos-record`) with the following models:

- **User**: Stores user credentials (username, password_hash, email, role) - seeded only, no registration
- **Worker**: Stores worker device information
- **Service**: Stores service definitions and configuration
- **ServiceDeployment**: Tracks service deployments across workers
- **Token**: Manages conductor registration tokens
- **Resource**: Tracks worker resource availability

## Authentication

- **User Login**: `POST /api/auth/login` - Authenticate with username/password, returns JWT token
- **Current User**: `GET /api/auth/me` - Get current authenticated user (requires JWT)
- **No Registration**: Users are seeded only, no public registration endpoint
- **JWT Tokens**: All authenticated requests require JWT token in Authorization header
- **Password Security**: Passwords are hashed using bcrypt before storage

## For contributors

Code lives in two npm workspaces (`conductor/`, `worker/`) plus per-manager packages under
`worker/<service>/`. Common standards (service/repository pattern, environment files,
inter-service communication) are documented in dedicated files:

- [`backend_guidelines.md`](backend_guidelines.md) — service/repo architecture, error handling,
  environment files, ORM usage.
- [`frontend_guidelines.md`](frontend_guidelines.md) — React Native dashboard structure,
  components, hooks, styles.
- [`testing_guidelines.md`](testing_guidelines.md) — unit + integration patterns.
- [`new_service.md`](new_service.md) — full walkthrough of adding a new manager service
  (folder layout, registration, health/metrics, tests, conductor seed).
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR workflow.

Local dev (no Docker):

```bash
cd conductor && npm install && npm run dev   # control plane in one terminal
cd worker && npm install && npm run dev      # worker agent in another
```

## Configuration

### Environment Variables

#### Conductor
- `PORT` - API server port (default: 3000)
- `DATABASE_PATH` - SQLite database path (default: ./data/conductor.db)
- `TOKEN_SECRET` - Secret for token generation
- `JWT_SECRET` - Secret for JWT token signing
- `JWT_EXPIRES_IN` - JWT token expiration time (default: 24h)

#### Worker
- `CONDUCTOR_TOKEN` - Registration token from conductor
- `CONDUCTOR_URL` - Full URL of the conductor (e.g. `http://localhost:3000`,
  `http://host.docker.internal:3000` from Docker on Mac/Windows, or `http://conductor:3000`
  if both run in the same compose network)
- `HEARTBEAT_INTERVAL` - Heartbeat interval in seconds (default: 5)
- `LOG_SPOOL` / `LOG_SHIP_BEARER` / `LOG_SHIP_PROJECT_ID` — opt-in offline log buffer
  (see [`GOLDEN_PATH.md`](GOLDEN_PATH.md) §5)

#### Services (key_manager, storage_manager, etc.)
- `PORT` - Service API port
- `CONDUCTOR_URL` - URL of conductor API
- `DATABASE_PATH` - SQLite database path for service
- Service-specific variables as needed

**Note**: Every service must have both `.env` and `.env_example` files. Copy `.env_example` to `.env` and fill in actual values.

## Troubleshooting

### Worker Not Registering
- Verify `CONDUCTOR_TOKEN` and `CONDUCTOR_IP` are set correctly
- Check network connectivity between worker and conductor
- Review conductor logs for registration errors

### Service Not Deploying
- Check worker resources are sufficient
- Verify service docker-compose.yml is valid
- Review conductor logs for deployment errors

### Database Issues
- Ensure SQLite database file has proper permissions
- Check database file path is correct
- Review database logs for errors

## Testing

### What `npm test` at the repo root does
Runs **npm workspaces** only: **`conductor/`** and the **`worker/`** agent (not every package under `worker/queue_manager`, etc.).

```bash
npm test                 # conductor + worker agent (same as test:conductor + test:worker via workspaces)
npm run test:conductor   # control plane Jest
npm run test:worker      # worker agent Jest (includes mock-conductor integration tests on port 31900 by default)
```

### Per-manager services
Each `worker/<service>/` is its own Node project. After `npm install` in that folder:

```bash
cd worker/queue_manager && npm test
cd worker/webhook_manager && npm test
```

The full list of ports and routes is in [`worker/MANAGER_SERVICES.md`](worker/MANAGER_SERVICES.md). Release checklist and deeper E2E: [`E2E.md`](E2E.md), [`TESTING.md`](TESTING.md), and [`todo.md`](todo.md) **Platform audit**.

### Unit vs integration
- **Unit / integration** live under `conductor/tests/` and `worker/tests/`.
- **Manager-specific** tests live under `worker/<name>/tests/`; some suites need env flags (e.g. `SKIP_DOCKER`, `SKIP_CLOUDFLARE`, `SKIP_OUTBOUND`) — see each service’s `tests/setup.js` and `README`.

## Security

Report vulnerabilities according to [`SECURITY.md`](SECURITY.md) (avoid public issues for unfixed security bugs).

## Production

Operator checklist, observability, and hardening notes: [`PRODUCTION.md`](PRODUCTION.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). CI runs
conductor + worker agent tests on every push/PR
(see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

Quick local checklist:

1. Read [`backend_guidelines.md`](backend_guidelines.md) (service/repo pattern, ORM, env files).
2. Keep Docker and `.env` / `.env_example` in sync for services you touch.
3. Add or extend tests; run `npm run test:conductor` and `npm run test:worker`.
4. For new manager services, follow [`new_service.md`](new_service.md).

> Long-form internal roadmap and engineering history live in [`plan.md`](plan.md) and
> [`todo.md`](todo.md). Treat them as planning notes, not specifications — shipped behavior
> is documented in this README, [`GOLDEN_PATH.md`](GOLDEN_PATH.md), and per-service READMEs.

## License

MIT — see [`LICENSE`](LICENSE). Notable changes are recorded in [`CHANGELOG.md`](CHANGELOG.md).

## Support

For bugs and feature requests, open an issue. For security reports, see
[`SECURITY.md`](SECURITY.md). Operator guidance is in [`PRODUCTION.md`](PRODUCTION.md).
