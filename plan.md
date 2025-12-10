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
- **Database**: `aerekos-record` (universal ORM) supports SQLite, PostgreSQL, MongoDB, Neo4j, Elasticsearch, Redis - **Use local copies**: `conductor/api/services/aerekos-record` for conductor, `worker/services/aerekos-record` for worker/services. SQLite is local; other databases use `db_manager` to store on other devices.
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

**Last Updated**: [Update this when tasks are completed]

**Current Chapter**: [x] Chapter 1: Conductor Setup ✅ **COMPLETE** 

**Status**: All backend phases (1-6, 8) complete! All 48 tests passing! ✅

**Next Steps**: 
1. [x] Complete [conductor/plan.md](./conductor/plan.md) - Conductor Setup ✅ **COMPLETE** (All 48 tests passing!)
2. [ ] Complete [worker/plan.md](./worker/plan.md) - Worker Setup  
3. [ ] Then move to individual service plan.md files
4. [ ] Implement enterprise features (Chapter 4) for production readiness
5. [ ] Production hardening and data center deployment preparation

---

## Chapter 1: Conductor Setup ✅ **COMPLETE**

**Status**: [x] Not Started | [x] In Progress | [x] Complete

**Follow**: [conductor/plan.md](./conductor/plan.md) for detailed conductor implementation checklist

**Overview**: Set up the conductor (master orchestrator) with database, authentication, worker registration, and service management.

**Prerequisites**: None - this is the starting point

**Completion Status**: 
- ✅ All backend phases (1-6, 8) complete
- ✅ All 48 tests passing (4 test suites)
- ✅ API endpoints working
- ✅ Database models created
- ✅ Authentication system complete
- ✅ Token generation working
- ✅ Health checks implemented
- ✅ Request ID middleware added
- ✅ API versioning in place
- ✅ Comprehensive test suite with setup/teardown

**When Complete**: Move to Chapter 2 (Worker Setup)

---

## Chapter 2: Worker Setup

**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

**Follow**: [worker/plan.md](./worker/plan.md) for detailed worker implementation checklist

**Overview**: Set up worker registration, heartbeat, resource monitoring, and Docker container management.

**Architecture Notes**:
- Conductor and Worker can run on the same device (but only one Conductor total)
- Worker's `docker-compose.yml` is responsible for spinning up services from the `worker/` folder
- Services are deployed based on configuration received from the conductor
- Worker receives deployment instructions from conductor and manages service containers accordingly

**Prerequisites**: Chapter 1 (Conductor Setup) must be complete

**When Complete**: Move to Chapter 3 (Services)

---

## Chapter 3: Services Implementation

**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

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
- [ ] [worker/key_manager/plan.md](./worker/key_manager/plan.md) - Key Manager Service (KMS) - **HIGH PRIORITY**
- [ ] [worker/storage_manager/plan.md](./worker/storage_manager/plan.md) - Storage Manager Service (S3-like) - **HIGH PRIORITY**

**Core Services**:
- [ ] [worker/api_manager/plan.md](./worker/api_manager/plan.md) - Click-to-build API service
- [ ] [worker/app_manager/plan.md](./worker/app_manager/plan.md) - React Native app builder
- [ ] [worker/db_manager/plan.md](./worker/db_manager/plan.md) - Database management service

**Additional Services** (implement in any order):
- [ ] [worker/auth_manager/plan.md](./worker/auth_manager/plan.md) - Authentication service
- [ ] [worker/ai_manager/plan.md](./worker/ai_manager/plan.md) - AI/ML service management
- [ ] [worker/analytics_manager/plan.md](./worker/analytics_manager/plan.md) - Analytics service
- [ ] [worker/balancer_manager/plan.md](./worker/balancer_manager/plan.md) - Load balancing
- [ ] [worker/cdn_manager/plan.md](./worker/cdn_manager/plan.md) - CDN service
- [ ] [worker/cicd_manager/plan.md](./worker/cicd_manager/plan.md) - CI/CD pipelines
- [ ] [worker/code_as_infra/plan.md](./worker/code_as_infra/plan.md) - Infrastructure as code
- [ ] [worker/crawler_manager/plan.md](./worker/crawler_manager/plan.md) - Web crawling
- [ ] [worker/domain_manager/plan.md](./worker/domain_manager/plan.md) - Domain management (Cloudflare)
- [ ] [worker/email_manager/plan.md](./worker/email_manager/plan.md) - Email service (Zoho)
- [ ] [worker/host_manager/plan.md](./worker/host_manager/plan.md) - Host management
- [ ] [worker/iam_manager/plan.md](./worker/iam_manager/plan.md) - Identity and Access Management
- [ ] [worker/logs_manager/plan.md](./worker/logs_manager/plan.md) - Logging service
- [ ] [worker/mcp_manager/plan.md](./worker/mcp_manager/plan.md) - MCP protocol
- [ ] [worker/metrics_manager/plan.md](./worker/metrics_manager/plan.md) - Metrics collection
- [ ] [worker/network_manager/plan.md](./worker/network_manager/plan.md) - Network management
- [ ] [worker/queue_manager/plan.md](./worker/queue_manager/plan.md) - Message queue
- [ ] [worker/schedule_manager/plan.md](./worker/schedule_manager/plan.md) - Task scheduling
- [ ] [worker/secrets_manager/plan.md](./worker/secrets_manager/plan.md) - Secrets management
- [ ] [worker/security_manager/plan.md](./worker/security_manager/plan.md) - Security monitoring
- [ ] [worker/slack_manager/plan.md](./worker/slack_manager/plan.md) - Slack integration
- [ ] [worker/sms_manager/plan.md](./worker/sms_manager/plan.md) - SMS service
- [ ] [worker/system_manager/plan.md](./worker/system_manager/plan.md) - System management (OS updates)
- [ ] [worker/tunnel_manager/plan.md](./worker/tunnel_manager/plan.md) - Tunneling (Cloudflare)
- [ ] [worker/webhook_manager/plan.md](./worker/webhook_manager/plan.md) - Webhook management
- [ ] [worker/worker_manager/plan.md](./worker/worker_manager/plan.md) - Worker management

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
- **Database**: Always use local `aerekos-record` copies - `conductor/api/services/aerekos-record` for conductor, `worker/services/aerekos-record` for worker/services. See [backend_guidelines.md](./backend_guidelines.md) for usage.
- **Service Plans**: Each service folder has its own `plan.md` file with detailed implementation checklist. Services can reference other services' plan.md files for dependencies (like linked lists). This main plan.md is the high-level roadmap - follow individual service plan.md files for detailed tasks.
- **External Integrations**: Some services integrate with external services (Cloudflare for domain/tunnel, Zoho for email, etc.)
- **Enterprise Features**: All services must implement health checks, metrics, logging, and security best practices
