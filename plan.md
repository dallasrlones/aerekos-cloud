> **Internal planning document.** This is the long-form roadmap and design history maintained
> by the project team. It is not part of the user-facing documentation. New users should start
> with the [README](README.md), [GOLDEN_PATH.md](GOLDEN_PATH.md), and [PRODUCTION.md](PRODUCTION.md)
> instead. Contributors are welcome to read this for context but should not treat it as a spec —
> shipped behavior is documented elsewhere.

# aerekos-cloud Implementation Checklist

## Project Description

**aerekos-cloud** is a production-ready, AWS-like cloud infrastructure platform that orchestrates distributed services across multiple worker devices using a conductor-worker architecture. Designed to scale from home lab to full data center deployment.

### Architecture Overview

- **Conductor**: The master orchestrator that manages all workers and services. It serves as the primary API for third-party applications, handles worker registration, manages service deployment, monitors health, implements auto-recovery, and provides a React Native frontend dashboard (web-first, mobile later). Uses SQLite (via `aerekos-record`) for state management. Supports backup conductor instances for high availability.

- **Workers**: Slave devices that host and run services. Workers self-register with the conductor using a token and IP address, report their resources (CPU, RAM, disk), run Docker containers as instructed, and maintain heartbeat connections. Workers automatically re-register after power outages or IP changes. **Note**: Conductor and Worker can run on the same device (but only one Conductor total). The worker's `docker-compose.yml` is responsible for spinning up services from the `worker/` folder based on configuration received from the conductor.

- **Services**: Containerized applications that provide cloud functionality. Each service lives in its own folder under `worker/`, has its own API, communicates with the conductor, implements health checks, reports metrics, and can be dynamically enabled/disabled and deployed across workers. **Services can use other services** - for example, storage_manager can use key_manager for encryption, and any service can use db_manager to create databases. All services implement enterprise-grade features: health checks, metrics, logging, security, and auto-recovery.

### Key Features

- Self-hosted, containerized cloud platform
- Token-based worker registration
- Dynamic service orchestration
- Intelligent worker selection based on resources
- JWT-based user authentication (users seeded only, no registration)
- Service/repository pattern for backend code
- React Native dashboard for management
- **Enterprise-grade**: Health checks, auto-recovery, metrics, alerting
- **High Availability**: Backup conductor support, service redundancy
- **Security**: Network segmentation, rate limiting, service-to-service auth
- **Observability**: Comprehensive logging, metrics, and monitoring
- **Data Center Ready**: Scalable architecture capable of running across multiple data centers

### Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: [`aerekos-record`](https://www.npmjs.com/package/aerekos-record) (universal ORM) supports SQLite, PostgreSQL, MongoDB, Neo4j, Elasticsearch, Redis — add the npm package per app/service (`conductor`, `worker/key_manager`, etc.). SQLite is local; other databases use `db_manager` to store on other devices.
- **Containerization**: Docker, Docker Compose
- **Frontend**: React Native
- **Authentication**: JWT tokens
- **Architecture**: Service/Repository pattern, DRY principles

### Implementation Priority

1. Foundation (Database, Auth, Core Setup)
2. **Frontend Setup (Web First)** - Get UI working early to see progress!
3. Worker Infrastructure (Registration & Discovery)
4. Core Services: **key_manager (KMS)** and **storage_manager (S3)** - HIGH PRIORITY
5. Additional Services (one by one)
6. **Enterprise Features** - Health checks, metrics, alerting, auto-recovery, security
7. Testing & Documentation
8. **Production Hardening** - Backup/restore, disaster recovery, high availability

### Code Standards & Guidelines

**IMPORTANT**: Follow the coding guidelines in these files:

- **[backend_guidelines.md](./backend_guidelines.md)** - Service/repository pattern, architecture, error handling
- **[frontend_guidelines.md](./frontend_guidelines.md)** - Component structure, hooks, API services, state management
- **[style_guidelines.md](./style_guidelines.md)** - Design system inspired by Assassin's Creed loading screens (dark theme, gold accents)
- **[testing_guidelines.md](./testing_guidelines.md)** - Unit tests, integration tests, test structure, coverage

**Quick Reference**:
- **Backend**: Follow service/repository pattern. Business logic in `services/`, database operations in `repos/`, thin routes. Keep code DRY.
- **Frontend**: Separate components, hooks, styles, and utils. Follow DRY principles. Use Assassin's Creed-inspired dark theme.
- **Environment Files**: Every service (including conductor) must have `.env` and `.env_example` files.
- **Testing**: Unit tests for services/repos, integration tests for APIs, test each service as implemented.

---

## Plan Structure

**This `plan.md` is the blueprint/chapter guide** - it tracks which "chapter" we're on and points to detailed implementation plans.

**How it works**:
- **Main plan.md** (this file) = High-level roadmap/chapter guide
- **[conductor/plan.md](./conductor/plan.md)** = Detailed conductor implementation checklist
- **[worker/plan.md](./worker/plan.md)** = Detailed worker implementation checklist  
- **[worker/[service_name]/plan.md](./worker/)** = Detailed service-specific implementation checklist

**Chapter Flow**:
1. **Chapter 1: Conductor Setup** → Follow [conductor/plan.md](./conductor/plan.md)
2. **Chapter 2: Worker Setup** → Follow [worker/plan.md](./worker/plan.md)
3. **Chapter 3: Services** → Follow individual [worker/[service_name]/plan.md](./worker/) files
4. **Chapter 4: Enterprise Features** → Production hardening, health checks, metrics, HA, security

Each detailed plan.md can reference other plan.md files for dependencies (like linked lists).

## Current Status

**Last Updated**: 2024-12-11

**Current Chapter**: [x] Chapter 1: Conductor Setup ✅ **COMPLETE** | [x] Chapter 2: Worker Setup ✅ **COMPLETE**

**Status**: 
- **Conductor Backend**: All phases (1-6, 8) complete! All 96 tests passing (excluding websocket timeout)! ✅
  - **Comprehensive Test Coverage**: Added 20+ tests for worker routes, WorkerService methods, and WorkerSocketService event handlers ✅
  - **Authentication**: Added authentication middleware to protected worker routes (GET /api/workers, GET /api/workers/:id) ✅
- **Conductor Frontend**: Phase 7 complete! All UI components, navigation, URL routing, device management, ServerVisual component, and real-time WebSocket updates complete ✅
- **Worker**: All phases (1-8) complete! All 124 tests passing! ✅
  - **Comprehensive Test Coverage**: Added 50+ tests for resourceDetector, ConductorService error paths, and ConductorSocketService ✅
  - **Persistent Worker ID**: Worker ID stored in `data/worker-id.json`, verified on startup, prevents re-registration on restarts ✅
  - **Real-time Resource Monitoring**: Host filesystem reads for accurate RAM/disk detection, macOS Docker scaling, fresh reads on every heartbeat ✅
  - **WebSocket Communication**: Socket.IO for real-time bidirectional communication, live resource updates ✅
- **Docker Setup**: Everything dockerized with development and production Dockerfiles ✅
- **Pre-commit Hook**: Husky pre-commit hook configured to run all tests before commits ✅

**Next Steps**: 
1. [x] Complete [conductor/plan.md](./conductor/plan.md) - Conductor Setup ✅ **COMPLETE** (All 96 tests passing!)
2. [x] Complete [worker/plan.md](./worker/plan.md) - Worker Setup ✅ **COMPLETE** (All 124 tests passing!)
3. [x] Set up pre-commit hook with comprehensive test coverage ✅ **COMPLETE**
4. [x] Create service implementation plans ✅ **COMPLETE**
   - [x] [worker/key_manager/plan.md](./worker/key_manager/plan.md) - Key Manager Service (KMS)
   - [x] [worker/storage_manager/plan.md](./worker/storage_manager/plan.md) - Storage Manager Service (S3)
   - [x] [worker/db_manager/plan.md](./worker/db_manager/plan.md) - Database Manager Service
   - [x] [new_service.md](./new_service.md) - Service creation best practices guide
5. [x] **CRITICAL**: Implement Projects feature (Chapter 2.5) ✅ **COMPLETE**
   - [x] Add Project model to conductor database ✅
   - [x] Link Workers to Projects (many-to-many) ✅
   - [x] Link Services to Projects (many-to-many) ✅
   - [x] Update ServiceDeployment to include project_id ✅
   - [x] Update worker registration to include project assignments ✅
   - [x] Update worker deployment logic to deploy services per project ✅
   - [x] Update container naming to include project prefix ✅
   - [x] Add project management API endpoints ✅
   - [x] Update frontend to support project management ✅
   - [ ] Add comprehensive tests for projects feature ⏳ PENDING
6. [ ] **CRITICAL**: Implement Service Orchestration & Auto-Assignment (Chapter 2.6) - **NEW PRIORITY**
   - [ ] Create ServiceOrchestrator service for intelligent worker selection
   - [ ] Implement auto-assignment algorithm based on worker resources
   - [ ] Add device-specific pinning support
   - [ ] Implement project service enable/disable and configuration
   - [ ] Create LoadBalancer service for horizontal scaling
   - [ ] Add service health monitoring and auto-recovery
   - [ ] Implement resource-based auto-scaling
   - [ ] Add comprehensive tests for orchestration logic
6. [ ] **CRITICAL**: Implement service registry in conductor:
   - [ ] `POST /api/services/register` - Service registration endpoint
   - [ ] `GET /api/services` - List all registered services
   - [ ] `GET /api/services/:name` - Get service details
   - [ ] `POST /api/services/validate-token` - Validate service tokens
   - [ ] Service routing middleware (`/api/services/:service_name/*`)
   - [ ] Service-to-service token generation
   - [ ] Load balancing across multiple service instances
7. [ ] Implement key_manager service
8. [ ] Implement storage_manager service
9. [ ] Implement db_manager service
10. [ ] Test inter-service communication
11. [ ] Implement enterprise features (Chapter 4) for production readiness
12. [ ] Production hardening and data center deployment preparation

---

## Chapter 1: Conductor Setup ✅ **COMPLETE**

**Status**: [x] Not Started | [x] In Progress | [x] Complete

**Follow**: [conductor/plan.md](./conductor/plan.md) for detailed conductor implementation checklist

**Overview**: Set up the conductor (master orchestrator) with database, authentication, worker registration, and service management.

**Prerequisites**: None - this is the starting point

**Completion Status**: 
- ✅ All backend phases (1-6, 8) complete
- ✅ Jest: run `cd conductor && npm test` — see [`todo.md`](./todo.md) *Platform audit* for latest count
- ✅ API endpoints working
- ✅ Database models created
- ✅ Authentication system complete
- ✅ Token generation working
- ✅ Health checks implemented
- ✅ Request ID middleware added
- ✅ API versioning in place
- ✅ Comprehensive test suite with setup/teardown
- ✅ Frontend Phase 7 complete: Header, Settings, Menu, Box components, navigation, URL-based routing, Devices management, **ServerVisual component**, **WebSocket live updates**

**When Complete**: Move to Chapter 2 (Worker Setup)

---

## Chapter 2: Worker Setup ✅ **COMPLETE**

**Status**: [x] Not Started | [x] In Progress | [x] Complete

**Follow**: [worker/plan.md](./worker/plan.md) for detailed worker implementation checklist

**Overview**: Set up worker registration, heartbeat, resource monitoring, and Docker container management.

**Architecture Notes**:
- **Conductor**: Has its own `docker-compose.yml` in `conductor/` folder (conductor + frontend)
- **Worker**: Has its own `docker-compose.yml` in `worker/` folder (primary worker container)
- **Services**: Each service has its own `docker-compose.yml` in `worker/[service_name]/` folder
- **Communication Flow**: Services → Worker Container → Conductor Container
- Each service is an API that talks to the worker container
- Worker container talks to conductor container
- Conductor and Worker can run on the same device (but only one Conductor total)
- Worker receives deployment instructions from conductor and manages service containers accordingly

**Completion Status**: 
- ✅ Conductor-side worker management (WorkerRepository, WorkerService, routes)
- ✅ Worker node implementation (registration, heartbeat, resource reporting)
- ✅ **Persistent Worker ID storage** (file-based, verified on startup, prevents re-registration)
- ✅ Resource detection utilities
- ✅ **Real-time host resource monitoring** (host filesystem reads, macOS Docker scaling, fresh reads on heartbeat)
- ✅ Conductor API client
- ✅ **WebSocket communication** (Socket.IO for real-time bidirectional updates)
- ✅ Health check and status endpoints
- ✅ Error handling and re-registration logic
- ✅ Docker Compose configuration
- ✅ Docker container management (Phase 3 complete)
- ✅ Service deployment handling (Phase 3 complete)
- ✅ Service status monitoring
- ✅ Docker error handling
- ✅ Testing infrastructure and unit tests (Phase 6 complete)
- ✅ Basic integration tests (Phase 6 complete)
- ⏳ Docker-dependent integration tests (requires Docker daemon)

**Prerequisites**: Chapter 1 (Conductor Setup) must be complete ✅

**When Complete**: Move to Chapter 2.5 (Projects Feature) or Chapter 3 (Services)

---

## Chapter 2.5: Projects Feature Implementation ✅ **COMPLETE**

**Status**: [x] Not Started | [x] In Progress | [x] Complete ✅

**Overview**: Add Projects as a global parent to all services and devices. Projects enable multi-tenancy where a single worker can host multiple projects (e.g., "development" and "production"), each with its own services and devices.

**Key Requirements**:
- Projects stored in conductor's SQLite database
- A single device/worker can host multiple projects
- Each project gets its own services and devices
- Worker registers with conductor, figures out what projects it has, and auto-deploys service containers per project
- A single worker can have development and production containers running on the same box
- Container naming includes project prefix (e.g., `aerekos-development-key_manager`)
- **UI/UX**: Project switcher dropdown in top left header (like GCP)
- **UI/UX**: First-time experience: Dashboard detects no projects and prompts to create one
- **UI/UX**: Full project CRUD (Create, Read, Update, Delete) with project details screen

**Architecture Changes**:
- **Database**: Add Project model, ProjectWorker join table, ProjectService join table, update ServiceDeployment to include project_id
- **Conductor**: Add project management API endpoints, update service deployment to be project-aware
- **Worker**: Update registration to receive project assignments, update deployment handler to deploy services per project, update container naming

**Prerequisites**: 
- Chapter 1 (Conductor Setup) must be complete ✅
- Chapter 2 (Worker Setup) must be complete ✅

**Follow**: See detailed implementation tasks in [conductor/plan.md](./conductor/plan.md) Phase 9 and [worker/plan.md](./worker/plan.md) Phase 10

**When Complete**: Move to Chapter 2.6 (Service Orchestration) or Chapter 3 (Services)

---

## Chapter 2.6: Service Orchestration & Auto-Assignment

**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

**Overview**: Implement intelligent service orchestration where the conductor automatically assigns services to devices based on worker resources, project requirements, and device-specific constraints. Supports horizontal scaling with load balancing.

**Key Architecture**:
- **Worker per Device**: One worker runs per device, manages Docker containers
- **Project-Specific Containers**: Worker spawns containers with project-prefixed naming (e.g., `my-project-psql`, `my-project-redis`)
- **Multi-Project Support**: Single worker can run containers for multiple projects simultaneously
- **Auto-Assignment**: Conductor analyzes all workers, their resources, and auto-assigns services to optimal devices
- **Service-Project Binding**: Services are attached to projects via ProjectService join table
- **Project Service Permissions**: Projects have a list of services they can use (enable/disable, configure per project)
- **Device-Specific Pinning**: Can pin specific services to specific devices (e.g., project-1's storage_manager on device-abc)
- **Load Balancing**: Conductor configures load balancing when multiple devices run the same service for horizontal scaling

**Service Assignment Flow**:
1. User enables a service for a project (via ProjectService join table)
2. Conductor evaluates all workers assigned to that project
3. Conductor checks worker resources (CPU, RAM, disk) and current load
4. Conductor selects optimal worker(s) based on:
   - Available resources
   - Device-specific pinning constraints
   - Load balancing requirements (if multiple instances needed)
   - Current service distribution
5. Conductor sends deployment instructions to selected worker(s)
6. Worker deploys service container with project-prefixed name
7. Conductor tracks deployment in ServiceDeployment table (with project_id)

**Device-Specific Pinning**:
- Can override auto-assignment for specific service-project-device combinations
- Stored in ServiceDeployment table with explicit worker_id and project_id
- Takes precedence over auto-assignment logic
- Useful for: database services, services requiring specific hardware, compliance requirements

**Load Balancing**:
- Conductor acts as load balancer (like AWS ALB/GCP Cloud Load Balancing)
- When multiple workers have the same service for a project, conductor routes requests across instances
- Load balancing algorithms: Round-robin, least-connections, weighted
- Health checks ensure only healthy instances receive traffic
- Service discovery: Services use simple names (e.g., `storage_manager`), conductor routes to correct instance
- Auto-scaling: Add/remove instances based on metrics (CPU, memory, request rate, custom metrics)

**Auto-Scaling (AWS/GCP-style)**:
- **Predefined Metrics**: CPU utilization (default target: 70%), Memory utilization (default target: 80%), Request rate
- **Custom Metrics**: Services can publish custom metrics (queue depth, processing time, etc.)
- **Scaling Policies**: Configurable per service-project (min/max instances, target metrics, cooldown periods)
- **Target Tracking**: Maintain target metric value (e.g., keep CPU at 70%)
- **Step Scaling**: Scale by fixed increments based on metric thresholds

**Resource Evaluation (AWS/GCP-style bin-packing)**:
- Considers **current resource usage** (CPU/RAM/disk in use) not just total resources
- Factors in **existing service deployments** on each worker
- **Placement Strategies**: Binpack (maximize utilization), Spread (maximize availability), Random
- Optimizes for resource efficiency while maintaining availability

**Frontend Requirements**:
- Service management UI (enable/disable, configure per project)
- Service instance monitoring and visualization
- Device-specific pinning UI
- Auto-scaling metrics visualization
- Load balancing visualization
- Service assignment visualization
- Service list and details screens

**Prerequisites**: 
- Chapter 2.5 (Projects Feature) must be complete ✅

**Follow**: See detailed implementation tasks in [conductor/plan.md](./conductor/plan.md) Phase 11 (includes frontend tasks in 11.14)

**When Complete**: Move to Chapter 3 (Services) or continue with service implementation

---

## Chapter 3: Services Implementation

**Status**: [x] Not Started | [x] In Progress | [ ] Complete

**Overview**: Implement individual services. Each service has its own `plan.md` file with detailed implementation steps.

**Prerequisites**: 
- Chapter 1 (Conductor Setup) must be complete
- Chapter 2 (Worker Setup) must be complete
- Service Registry must be set up (part of conductor)

**Enterprise Features** (implement as part of services - see Chapter 4):
- Health checks (`/health`, `/ready`) and auto-recovery for all services
- Comprehensive metrics and alerting integration
- Service-to-service authentication (JWT or mTLS)
- Rate limiting and throttling on all endpoints
- Network segmentation (VPC-like) and security policies
- Structured logging with correlation IDs
- Circuit breakers and retry logic
- Backup and disaster recovery

**Priority Services** (implement these first):
- [x] [worker/key_manager/plan.md](./worker/key_manager/plan.md) - Key Manager Service (KMS) - **HIGH PRIORITY** - ✅ **BACKEND COMPLETE | FRONTEND MOSTLY COMPLETE**
  - **Status**: Foundation service - ✅ **COMPLETE**
  - **Backend**: All phases (1-7) complete, comprehensive tests passing
  - **Frontend**: Service management, key list/details/create screens, archive functionality (delete removed per security best practices)
  - **Dependencies**: Conductor only
- [x] [worker/storage_manager/plan.md](./worker/storage_manager/plan.md) - Storage Manager Service (S3-like) - **HIGH PRIORITY** - ✅ **BACKEND COMPLETE | FRONTEND MOSTLY COMPLETE**
  - **Status**: ✅ **COMPLETE**
  - **Backend**: All phases (1-7) complete, comprehensive tests passing
  - **Frontend**: Service management, projects/buckets/files management UI, file upload/download
  - **Dependencies**: Conductor, key_manager
  - **Features**: Projects → Buckets → Files, automatic encryption, chunked uploads, signed URLs
  - **Roadmap**: Host **drive detection** and **drive speed** / throughput signals (worker-assisted where containers lack host visibility) — see [worker/storage_manager/plan.md](./worker/storage_manager/plan.md) (*Host drives, devices & performance*).
- [ ] [worker/db_manager/plan.md](./worker/db_manager/plan.md) - Database management service - ⏳ **IN PROGRESS**
  - **Status**: Core implementation complete, database handlers implemented, TDD testing in progress
  - **Backend**: Phases 1-5 complete (core, InstanceService, health checks), BackupService pending
  - **Database Types**: PostgreSQL ✅, MongoDB ✅, Redis ✅, Neo4j ✅, Elasticsearch ✅, SQLite3 ⏳
  - **Frontend**: Database management UI complete (create, list, details, health checks)
  - **Dependencies**: Conductor, Worker (Docker), key_manager (for encryption)
  - **Current Work**: Implementing TDD tests for all database types to ensure reliability

**Recommended Implementation Order**:
1. **Start ALL 3 services IN PARALLEL**:
   - `key_manager`: Foundation service (no dependencies)
   - `storage_manager`: Can stub key_manager calls during development, integrate when ready
   - `db_manager`: Completely independent (can use SQLite fallback)

**Why parallel works**:
- `key_manager`: Only needs Conductor, can start immediately
- `storage_manager`: Can implement 90% of features (projects, buckets, files, chunked uploads, signed URLs) and stub encryption calls
- `db_manager`: Completely independent, only needs Conductor + Worker

**Integration Strategy**:
- `storage_manager` stubs key_manager calls with mocks during development
- Once `key_manager` is ready, replace stubs with real API calls
- This allows maximum parallelization and faster overall completion

**Manager service packages** (Express + Jest + Docker + `plan.md` / `README.md`): See [worker/MANAGER_SERVICES.md](./worker/MANAGER_SERVICES.md) for ports, routes, and which use the P4 SQLite generator. Empty shells from `node worker/scripts/scaffold-manager-services.mjs` may still show `status: "stub"` until implemented. P4 batch: `node worker/scripts/generate-p4-sqlite-mvp.mjs`. Authoritative status: [`todo.md`](./todo.md).

**Implemented (MVP+)** — see each `plan.md` / `README.md`:
- [x] [worker/compute_manager/plan.md](./worker/compute_manager/plan.md) — task API (dockerode)
- [x] [worker/queue_manager/plan.md](./worker/queue_manager/plan.md) — message queues
- [x] [worker/schedule_manager/plan.md](./worker/schedule_manager/plan.md) — cron + dispatch
- [x] [worker/network_manager/plan.md](./worker/network_manager/plan.md) — per-project Docker networks
- [x] [worker/logs_manager/plan.md](./worker/logs_manager/plan.md) — log ingest/query
- [x] [worker/iam_manager/plan.md](./worker/iam_manager/plan.md) — roles, policies, bindings
- [x] [worker/secrets_manager/plan.md](./worker/secrets_manager/plan.md) — encrypted secrets
- [x] [worker/domain_manager/plan.md](./worker/domain_manager/plan.md) — Cloudflare DNS
- [x] [worker/tunnel_manager/plan.md](./worker/tunnel_manager/plan.md) — Cloudflare Tunnel
- [x] [worker/registry_manager/plan.md](./worker/registry_manager/plan.md) — registry config / discovery

**P4 control-plane (SQLite, no keys in Jest) — in repo; deepen per `plan.md`:** [worker/MANAGER_SERVICES.md](./worker/MANAGER_SERVICES.md) lists ports and main routes. Generator: `node worker/scripts/generate-p4-sqlite-mvp.mjs`. **Still to harden (needs keys, sidecars, or product scope):** real SMTP / SMS / Slack sends, LLM inference, CI job runners, host-level exec, full crawl fetches, OIDC with client secret from `secrets_manager`, cloud LBs, production analytics, etc. Per-service checklists remain in each `plan.md`.

**Note**: Services can reference other services' plan.md files for dependencies (like linked lists).

---

## Chapter 4: Enterprise Features & Production Hardening

**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

**Overview**: Implement enterprise-grade features to make the platform production-ready and data-center capable. These features ensure reliability, security, observability, and scalability.

**Prerequisites**: 
- Chapter 1-3 should be mostly complete
- Core services (key_manager, storage_manager) should be functional
- Basic service deployment should be working

**Key Areas**:

### 4.1 Health Checks & Auto-Recovery
- [ ] Implement health check endpoints for all services (`/health`, `/ready`)
- [ ] Conductor monitors service health and auto-restarts failed services
- [ ] Implement circuit breakers for inter-service communication
- [ ] Add graceful degradation when dependencies are unavailable
- [ ] Implement retry logic with exponential backoff
- [ ] Add health check monitoring dashboard

### 4.2 Metrics & Alerting
- [ ] Integrate all services with `metrics_manager`
- [ ] Set up alerting thresholds (CPU, memory, errors, latency)
- [ ] Create real-time dashboards for system health
- [ ] Implement log aggregation via `logs_manager`
- [ ] Add distributed tracing for request tracking
- [ ] Set up alerting notifications (email, Slack, etc.)

### 4.3 High Availability
- [ ] Deploy critical services across multiple workers
- [ ] Implement backup conductor support
- [ ] Set up database replication via `db_manager`
- [ ] Configure load balancing via `balancer_manager`
- [ ] Implement automatic failover mechanisms
- [ ] Test failover scenarios

### 4.4 Security & Network Segmentation
- [ ] Implement network segmentation via `network_manager` (VPC-like)
- [ ] Add service-to-service authentication (JWT or mTLS)
- [ ] Implement API rate limiting
- [ ] Add request throttling based on resources
- [ ] Enforce security policies via `security_manager`
- [ ] Secure secrets management via `secrets_manager`
- [ ] Implement network isolation between services

### 4.5 Backup & Disaster Recovery
- [ ] Implement automated backups for conductor state
- [ ] Set up automated backups for service databases
- [ ] Store backups in `storage_manager` or external storage
- [ ] Implement point-in-time recovery
- [ ] Document disaster recovery procedures
- [ ] Test backup restoration regularly
- [ ] Set up backup retention policies

### 4.6 Observability
- [ ] Implement structured logging (JSON) across all services
- [ ] Add correlation IDs for request tracking
- [ ] Monitor performance metrics (latency, throughput, errors)
- [ ] Track resource usage per service/worker
- [ ] Create comprehensive monitoring dashboards
- [ ] Implement log retention and archival

### 4.7 Scalability & Performance
- [ ] Test horizontal scaling (adding workers)
- [ ] Implement auto-scaling based on load (advanced)
- [ ] Optimize resource allocation algorithms
- [ ] Test multi-data center deployment scenarios
- [ ] Document scaling procedures
- [ ] Performance testing and optimization
- [ ] Implement caching strategies

**When Complete**: Platform is production-ready and data-center capable

---

## Additional Chapters

**Frontend, Infrastructure, Testing, and Advanced Features** are covered in their respective plan.md files:
- Frontend implementation details → See conductor plan.md (frontend is part of conductor)
- Infrastructure setup → See conductor/plan.md and worker/plan.md
- Testing → See [testing_guidelines.md](./testing_guidelines.md) and individual service plan.md files
- Advanced features → Will be added to conductor/plan.md and service plan.md files as needed

---

## Code Organization & Best Practices

**See detailed guidelines in:**
- [backend_guidelines.md](./backend_guidelines.md) - Complete backend architecture and patterns
- [frontend_guidelines.md](./frontend_guidelines.md) - Complete frontend architecture and patterns
- [style_guidelines.md](./style_guidelines.md) - Complete design system and styling guide
- [testing_guidelines.md](./testing_guidelines.md) - Complete testing standards and practices

### Quick Reference

**Backend Architecture**:
- **Services Layer**: Business logic should live in service classes (e.g., `UserService`, `KeyService`)
- **Repository Layer**: Database operations should live in repository classes (e.g., `UserRepository`, `KeyRepository`)
- **DRY Principle**: Don't Repeat Yourself - extract common functionality into utilities/services
- **Separation of Concerns**: Keep routes thin, move logic to services
- **Environment Files**: Every service (including conductor) must have `.env` and `.env_example` files

**Frontend Architecture (React Native)**:
- **Components**: Reusable UI components in `components/` folder
- **Hooks**: Custom hooks in `hooks/` folder
- **Styles**: Style definitions in `styles/` folder (separate from components) - **Use Assassin's Creed-inspired dark theme**
- **Utils**: Utility functions in `utils/` folder
- **DRY Principle**: Extract reusable logic into hooks and utils

**Testing Standards**:
- **Unit Tests**: Test individual functions, services, and repositories
- **Integration Tests**: Test service interactions and API endpoints
- **Coverage**: Maintain good test coverage for critical paths
- **Test Organization**: Mirror source structure in test folders

---

## Service Architecture & Inter-Service Communication

### Services Can Use Other Services

Services are designed to be composable and can call other services through the conductor API:

- **storage_manager** can use **key_manager** for encryption:
  - Storage manager can request encryption keys from key_manager
  - Objects can be encrypted/decrypted using key_manager API
  - Example: Encrypt stored objects before saving, decrypt when retrieving

- **Other services** can use **db_manager** for database management:
  - Services can request database creation via db_manager API
  - Services can manage their own databases (PostgreSQL, MongoDB, etc.)
  - Example: A service needs a PostgreSQL database → calls db_manager to create it
  - **api_manager** uses db_manager to select/create databases for user-built REST APIs

- **app_manager** and **api_manager** work together:
  - app_manager can easily access api_manager APIs within its interface
  - Users can build APIs with api_manager, then connect React Native apps built with app_manager to those APIs
  - Seamless integration between frontend app building and backend API building
  - app_manager interface provides direct access to api_manager for API selection and connection

- **Service Discovery**: Services discover other services through conductor's service registry
- **Service Communication**: All inter-service communication goes through conductor API routing
- **Service Clients**: Create reusable client utilities for common service-to-service calls

### Examples of Inter-Service Usage

1. **storage_manager → key_manager**: Request encryption keys for encrypting stored objects
2. **api_manager → db_manager**: Request database creation/selection for building REST APIs
3. **app_manager → api_manager**: Access and use api_manager REST APIs directly within app_manager interface to connect React Native apps to backend APIs
4. **Any service → db_manager**: Request database creation/management for service-specific data
5. **Any service → storage_manager**: Store files/assets using storage_manager API
6. **Any service → key_manager**: Encrypt sensitive data before storage
7. **api_manager**: Generates REST APIs with JWT authentication for user-defined models

### External Service Integrations

Some services integrate with external third-party services:

- **domain_manager**: Uses **Cloudflare** API for domain registration, DNS management, and domain configuration
- **tunnel_manager**: Uses **Cloudflare** for creating secure tunnels (Cloudflare Tunnel) and exposing local services
- **email_manager**: Uses **Zoho** API to start with for email service setup and management
- Other services may integrate with external APIs as needed (e.g., Slack API for slack_manager, SMS providers for sms_manager)

## Enterprise-Grade Features (Data Center Ready)

### Health Checks & Auto-Recovery
- **Health Checks**: Every service must implement health check endpoints (`/health`, `/ready`)
- **Auto-Recovery**: Conductor monitors service health and automatically restarts failed services
- **Circuit Breakers**: Implement circuit breakers for inter-service communication
- **Graceful Degradation**: Services should handle dependencies being unavailable gracefully
- **Retry Logic**: Exponential backoff for failed operations

### Metrics & Alerting
- **Metrics Collection**: All services report metrics to `metrics_manager`
- **Alerting**: `metrics_manager` triggers alerts based on thresholds (CPU, memory, errors, latency)
- **Dashboards**: Real-time dashboards showing system health, resource usage, service status
- **Log Aggregation**: `logs_manager` collects and aggregates logs from all services
- **Distributed Tracing**: Track requests across services for debugging

### High Availability
- **Service Redundancy**: Deploy critical services across multiple workers
- **Backup Conductor**: Support for backup conductor instances (planned in advanced features)
- **Database Replication**: Use `db_manager` to set up database replication for critical data
- **Load Balancing**: `balancer_manager` distributes traffic across service instances
- **Failover**: Automatic failover when workers or services fail

### Security & Network Segmentation
- **Network Segmentation**: `network_manager` creates isolated networks (VPC-like)
- **Service-to-Service Auth**: Services authenticate with each other using JWT or mTLS
- **Rate Limiting**: API rate limiting to prevent resource exhaustion
- **Throttling**: Throttle requests based on resource availability
- **Security Policies**: `security_manager` enforces security policies across services
- **Secrets Management**: `secrets_manager` securely stores and rotates secrets

### Backup & Disaster Recovery
- **Automated Backups**: Regular backups of conductor state and service databases
- **Backup Storage**: Store backups in `storage_manager` or external storage
- **Point-in-Time Recovery**: Ability to restore to specific points in time
- **Disaster Recovery Plan**: Documented procedures for full system recovery
- **Backup Testing**: Regularly test backup restoration

### Observability
- **Structured Logging**: All services use structured logging (JSON format)
- **Log Levels**: Proper log levels (DEBUG, INFO, WARN, ERROR)
- **Correlation IDs**: Track requests across services using correlation IDs
- **Performance Monitoring**: Monitor latency, throughput, error rates
- **Resource Monitoring**: Track CPU, memory, disk, network usage per service/worker

### Scalability
- **Horizontal Scaling**: Add workers to scale compute capacity
- **Auto-Scaling**: Automatically scale services based on load (advanced feature)
- **Resource Optimization**: Intelligent resource allocation and optimization
- **Multi-Data Center**: Architecture supports deployment across multiple data centers
- **Geographic Distribution**: Deploy workers in different geographic locations

## Notes

- Each service in `worker/` folder should have its own API that communicates with conductor
- Conductor acts as the single source of truth for all service routing
- **Services can use other services** - All inter-service communication goes through conductor
- Workers are stateless and rely on conductor for orchestration
- **Worker Deployment**: Worker's `docker-compose.yml` spins up services from `worker/` folder based on conductor configuration
- Conductor and Worker can run on the same device (but only one Conductor total)
- **Data Center Ready**: Architecture designed to scale from home lab to full data center deployment
- All services should be containerized and managed via Docker
- SQLite database should be backed up regularly (automated backup system)
- Consider implementing WebSocket for real-time updates between conductor and workers
- **User Authentication**: Users are seeded only, no registration endpoint. Login uses JWT tokens.
- **Service Priority**: Start with key_manager (KMS) and storage_manager (S3), then implement other services one by one
- **Code Standards**: Follow service/repo pattern, keep code DRY, maintain separation of concerns
- **Database**: Use the [`aerekos-record`](https://www.npmjs.com/package/aerekos-record) npm package in each package that needs it. See [backend_guidelines.md](./backend_guidelines.md) for usage.
- **Service Plans**: Each service folder has its own `plan.md` file with detailed implementation checklist. Services can reference other services' plan.md files for dependencies (like linked lists). This main plan.md is the high-level roadmap - follow individual service plan.md files for detailed tasks.
- **External Integrations**: Some services integrate with external services (Cloudflare for domain/tunnel, Zoho for email, etc.)
- **Enterprise Features**: All services must implement health checks, metrics, logging, and security best practices
