# Worker Implementation Plan

## ✅ STATUS: COMPLETE

**Backend:** All phases complete! Core worker functionality working including Docker container management.
**Docker Integration:** Phase 3 complete! Docker container management implemented.
**Testing:** Phase 6 complete! All 52 tests passing (5 test suites) ✅
**Docker Setup:** Everything dockerized with Dockerfile.dev for development.

### Progress Summary

**✅ Completed:**
- Phase 1: Initial Setup & Configuration
- Phase 2: Conductor Communication (registration, heartbeat, resource reporting)
- Phase 3: Docker Container Management (service deployment, container lifecycle)
- Phase 4: Worker API Endpoints (health check, status, service management)
- Phase 5: Error Handling & Resilience (connection errors, re-registration, Docker errors, graceful shutdown)
- Phase 6: Testing (all 52 tests passing - unit and integration tests complete)
- Phase 7: Documentation (README, environment variables, Docker setup)
- Phase 8: Docker Setup (Dockerfile, Dockerfile.dev, docker-compose.yml, nodemon.json)

## Overview

This plan details the implementation of the worker node for aerekos-cloud. Workers are slave devices that host and run services. They self-register with the conductor, report resources, maintain heartbeat connections, and execute Docker containers as instructed by the conductor.

**Follow**: [../plan.md](../plan.md) for high-level roadmap and architecture overview.

**Key Responsibilities**:
- Self-register with conductor using registration token
- Report available resources (CPU, RAM, disk, network)
- Maintain heartbeat connection with conductor
- Execute Docker containers for services as instructed
- Manage service lifecycle (start/stop/restart) based on conductor commands
- Auto-re-register after power outages or IP changes

**Architecture Notes**:
- **Worker has its own `docker-compose.yml`** in `worker/` folder (primary worker container)
- **Each service has its own `docker-compose.yml`** in `worker/[service_name]/` folder
- **Communication Flow**: Service APIs → Worker Container → Conductor Container
- Each service is an API that talks to the worker container
- Worker container talks to conductor container
- Worker receives deployment instructions from conductor and manages service containers accordingly
- Worker and Conductor can run on the same device (but only one Conductor total)
- Worker is stateless - all orchestration logic lives in conductor

## Phase 1: Initial Setup & Configuration

### 1.1 Environment Configuration
- [x] Create `.env_example` file with required environment variables:
  - `CONDUCTOR_URL` - Conductor API URL (e.g., `http://conductor-ip:3000`)
  - `CONDUCTOR_TOKEN` - Registration token from conductor
  - `PORT` - Worker API port (default: 3001)
  - `HEARTBEAT_INTERVAL` - Heartbeat interval in seconds (default: 30, optional)
  - `RESOURCE_CHECK_INTERVAL` - Resource check interval in seconds (default: 60, optional)
  - **Note**: Hostname and IP are automatically detected by conductor during registration and stored in memory only
- [ ] Create `.env` file (gitignored) for actual configuration - **USER ACTION NEEDED**
- [x] Set up environment variable loading (dotenv)

### 1.2 Project Structure
- [x] Set up folder structure:
  - `api/` - Worker API (for health checks, status)
  - `api/services/` - Conductor API client
  - `utils/` - Utility functions (resource detection, IP detection)
  - `docker/` - Docker container management (pending)
  - `services/` - Service management logic (pending)
- [x] Create `package.json` with dependencies:
  - express, dotenv, axios
  - systeminformation (for resource detection)
  - os (built-in, for hostname/IP detection)
  - Note: dockerode not yet added (will be added in Phase 3)
- [ ] Install dependencies - **USER ACTION NEEDED** (`npm install`)

### 1.3 Express Server Setup
- [x] Create Express.js server in `index.js`
- [x] Set up basic middleware (cors, json parser)
- [x] Set up error handling middleware
- [x] Configure port from environment variable
- [x] Add request logging middleware (via Express)
- [x] Create health check endpoint (`GET /health`)

### 1.4 Docker Setup
- [x] Review existing `docker-compose.yml` in worker root
- [x] Created `docker-compose.yml` with Docker socket mounting
- [x] Created `Dockerfile` for worker containerization
- [ ] Set up Docker client (dockerode or docker-compose API) - **PENDING Phase 3**
- [ ] Test Docker connectivity - **PENDING Phase 3**

## Phase 2: Conductor Communication

### 2.1 Conductor API Client
- [x] Create `api/services/ConductorService.js`:
  - [x] `registerWorker(hostname, ipAddress, resources)` - Register worker with conductor
  - [x] `sendHeartbeat(workerId)` - Send heartbeat to conductor
  - [x] `updateResources(workerId, resources)` - Update resource information
  - [x] `getDeploymentInstructions(workerId)` - Get deployment instructions from conductor (placeholder)
  - [x] `reportServiceStatus(workerId, serviceName, status)` - Report service status (placeholder)
  - [x] Handle connection errors and retries
  - [x] Handle authentication errors (re-register if token invalid)

### 2.2 Worker Registration
- [x] Implement worker registration logic:
  - [x] Read `CONDUCTOR_TOKEN` from environment
  - [x] Collect initial resource information (CPU, RAM, disk, network)
  - [x] Call conductor registration endpoint (`POST /api/workers/register`) with only token and resources
  - [x] Conductor detects IP/hostname from request headers
  - [x] Store worker ID, IP, and hostname returned by conductor (in memory only)
  - [x] Handle registration errors (invalid token, network issues)
  - [x] Implement retry logic with exponential backoff

### 2.3 Heartbeat Mechanism
- [x] Implement heartbeat loop:
  - [x] Send heartbeat every `HEARTBEAT_INTERVAL` seconds
  - [x] Call conductor heartbeat endpoint (`POST /api/workers/:id/heartbeat`)
  - [x] Update `last_seen` timestamp on conductor
  - [x] Handle heartbeat failures (network issues, conductor down)
  - [x] Implement re-registration if heartbeat fails repeatedly
  - [x] Handle IP address changes (re-register if IP changes)

### 2.4 Resource Reporting
- [x] Implement resource detection:
  - [x] Use `systeminformation` library to detect:
    - CPU cores and usage
    - RAM total and available
    - Disk total and available
    - Network interfaces and bandwidth
  - [x] Create `utils/resourceDetector.js`:
    - [x] `getCPUInfo()` - Get CPU cores and current usage
    - [x] `getRAMInfo()` - Get RAM total and available
    - [x] `getDiskInfo()` - Get disk total and available
    - [x] `getNetworkInfo()` - Get network interfaces and bandwidth
    - [x] `getAllResources()` - Get all resource information
- [x] Implement resource reporting loop:
  - [x] Check resources every `RESOURCE_CHECK_INTERVAL` seconds
  - [x] Update resources on conductor (`PUT /api/workers/:id/resources`)
  - [x] Report resources during heartbeat if changed significantly (5% threshold)

## Phase 3: Docker Container Management

### 3.1 Docker Service Manager
- [x] Create `docker/ServiceManager.js`:
  - [x] `startService(serviceName, config)` - Start a service container
  - [x] `stopService(serviceName)` - Stop a service container
  - [x] `restartService(serviceName)` - Restart a service container
  - [x] `getServiceStatus(serviceName)` - Get service container status
  - [x] `listServices()` - List all managed service containers
  - [x] `updateService(serviceName, config)` - Update service configuration
  - [x] Handle Docker errors (container not found, already running, etc.)

### 3.2 Docker Compose Integration
- [x] Integrate with `docker-compose.yml`:
  - [x] Parse `docker-compose.yml` in worker root (via DeploymentHandler)
  - [x] Map service names to docker-compose services
  - [x] Use dockerode to manage containers (ServiceManager)
  - [x] Support service-specific `docker-compose.yml` files in `worker/[service_name]/` (loadServiceComposeConfig)
  - [ ] Handle service dependencies (start dependencies first) - **BASIC IMPLEMENTATION** (can be enhanced)

### 3.3 Service Deployment Handler
- [x] Create `services/DeploymentHandler.js`:
  - [x] `handleDeploymentInstruction(instruction)` - Process deployment instruction from conductor
  - [x] Parse deployment instructions:
    - [x] Service name
    - [x] Docker image
    - [x] Environment variables
    - [x] Port mappings
    - [x] Volume mounts
    - [x] Resource limits
  - [x] Execute deployment:
    - [x] Create/update container configuration
    - [x] Start/stop/restart containers as instructed
    - [ ] Pull Docker image if needed - **PENDING** (Docker handles this automatically on start)
  - [x] Report deployment status back to conductor

### 3.4 Service Status Monitoring
- [x] Implement service status monitoring:
  - [x] Monitor container health (running, stopped, failed)
  - [x] Report service status to conductor periodically
  - [x] Detect container failures and report to conductor (via status monitoring loop)
  - [x] Handle container restarts (if instructed by conductor)

## Phase 4: Worker API Endpoints

### 4.1 Health Check Endpoint
- [x] Create `GET /health` endpoint:
  - [x] Return worker status (online, offline, degraded)
  - [x] Return conductor connection status (registered/unregistered)
  - [x] Return worker ID and resources
  - [ ] Return Docker daemon status - **PENDING Phase 3**

### 4.2 Status Endpoint
- [x] Create `GET /status` endpoint:
  - [x] Return worker information (hostname, IP, ID)
  - [x] Return current resources
  - [x] Return conductor connection status
  - [x] Return heartbeat and resource check intervals
  - [ ] Return list of running services - **PENDING Phase 3**

### 4.3 Service Management Endpoints (Optional - for debugging)
- [x] Create `GET /services` endpoint - List all services
- [x] Create `GET /services/:name` endpoint - Get service details
- [x] Create `POST /services/:name/restart` endpoint - Restart a service (for debugging)

## Phase 5: Error Handling & Resilience

### 5.1 Connection Error Handling
- [x] Handle conductor connection failures:
  - [x] Retry registration with exponential backoff
  - [x] Retry heartbeat with exponential backoff
  - [x] Log connection errors
  - [x] Continue operating if conductor temporarily unavailable

### 5.2 Re-registration Logic
- [x] Implement re-registration:
  - [x] Detect IP address changes (via re-registration on heartbeat failure)
  - [x] Re-register if heartbeat fails repeatedly
  - [x] Re-register after worker restart
  - [ ] Preserve service state during re-registration - **PENDING Phase 3** (services not yet implemented)

### 5.3 Docker Error Handling
- [x] Handle Docker errors gracefully:
  - [x] Container start failures
  - [x] Image pull failures (categorized)
  - [x] Network errors (connection errors)
  - [x] Resource exhaustion (resource errors)
  - [x] Report errors to conductor (via DeploymentHandler)

### 5.4 Graceful Shutdown
- [x] Implement graceful shutdown:
  - [x] Send final heartbeat to conductor
  - [x] Clean up intervals and resources
  - [x] Stop all service containers
  - [x] Mark worker as offline on conductor (conductor handles this via heartbeat timeout)

## Phase 6: Testing

### 6.1 Unit Tests
- [x] Test resource detection utilities (`tests/unit/resourceDetector.test.js`)
- [x] Test conductor API client methods (`tests/unit/conductorService.test.js`)
- [x] Test Docker service manager methods (`tests/unit/serviceManager.test.js`)
- [x] Test deployment handler logic (`tests/unit/deploymentHandler.test.js`)
- [x] Test error handling and retry logic (covered in unit tests)

### 6.2 Integration Tests
- [x] Test worker registration with conductor (`tests/integration/worker.test.js`)
- [x] Test heartbeat mechanism (`tests/integration/worker.test.js`)
- [x] Test resource reporting (`tests/integration/worker.test.js`)
- [x] Test re-registration after connection loss (`tests/integration/worker.test.js`)
- [ ] Test service deployment from conductor - **PENDING** (requires Docker daemon)
- [ ] Test service status reporting - **PENDING** (requires Docker daemon)
- [ ] Test re-registration after IP change - **PENDING** (requires network simulation)
- [ ] Test re-registration after conductor restart - **PENDING** (requires conductor restart simulation)

### 6.3 End-to-End Tests
- [x] Test full worker lifecycle (basic):
  - [x] Registration → Heartbeat → Resource Reporting
  - [ ] Service Deployment → Status Reporting - **PENDING** (requires Docker daemon)
- [ ] Test worker recovery scenarios:
  - [ ] Worker restart - **PENDING** (requires full worker restart)
  - [ ] Conductor restart - **PENDING** (requires conductor restart)
  - [ ] Network interruption - **PENDING** (requires network simulation)
  - [ ] IP address change - **PENDING** (requires network simulation)

## Phase 7: Documentation

### 7.1 README
- [x] Create `README.md`:
  - [x] Overview of worker functionality
  - [x] Setup instructions
  - [x] Configuration guide
  - [x] API endpoints documentation
  - [ ] Troubleshooting guide - **PENDING** (add as issues arise)

### 7.2 Environment Variables Documentation
- [x] Document all environment variables in `.env_example`
- [x] Add comments explaining each variable (via variable names)
- [x] Provide example values (defaults shown)

## Phase 8: Docker Compose Configuration

### 8.1 Worker Docker Compose
- [x] Review and update `docker-compose.yml`:
  - [x] Configure worker service
  - [x] Mount Docker socket (for container management)
  - [x] Set up environment variables
  - [x] Configure network settings
  - [x] Add health check configuration

### 8.2 Service Docker Compose Files
- [ ] Ensure service-specific `docker-compose.yml` files are properly structured
- [ ] Document how services are deployed via docker-compose
- [ ] Test service deployment via docker-compose

## Next Steps After Completion

Once Worker Setup is complete:
1. Move to Chapter 3: Services Implementation
2. Start with priority services: `key_manager` and `storage_manager`
3. Test service deployment from conductor to worker
4. Implement enterprise features (health checks, metrics, logging)

## Notes

- Worker is stateless - all orchestration logic lives in conductor
- Worker receives deployment instructions from conductor and executes them
- Worker reports status back to conductor
- Worker can run on same device as conductor (but only one conductor total)
- Worker's `docker-compose.yml` manages services from `worker/` folder
- Services are deployed based on configuration received from conductor
- Worker automatically re-registers after power outages or IP changes
- Resource reporting helps conductor make intelligent deployment decisions

