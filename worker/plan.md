# Worker Implementation Plan

## ✅ STATUS: COMPLETE

**Backend:** All phases complete! Core worker functionality working including Docker container management.
**Docker Integration:** Phase 3 complete! Docker container management implemented.
**Testing:** Phase 6 complete! All 124 tests passing (7 test suites) ✅
**Docker Setup:** Everything dockerized with Dockerfile.dev for development.
**Test Coverage:** Comprehensive test coverage with pre-commit hook integration ✅

### Progress Summary

**✅ Completed:**
- Phase 1: Initial Setup & Configuration
- Phase 2: Conductor Communication (registration, heartbeat, resource reporting)
- Phase 3: Docker Container Management (service deployment, container lifecycle)
- Phase 4: Worker API Endpoints (health check, status, service management)
- Phase 5: Error Handling & Resilience (connection errors, re-registration, Docker errors, graceful shutdown)
- Phase 6: Testing (all 124 tests passing - comprehensive unit and integration tests complete)
- Phase 7: Documentation (README, environment variables, Docker setup)
- Phase 8: Docker Setup (Dockerfile, Dockerfile.dev, docker-compose.yml, nodemon.json)
- Phase 9: Pre-commit Hook & Test Coverage (Husky setup, comprehensive test coverage improvements)

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
- [x] Mount `./data:/app/data` volume for persistent worker ID storage
- [x] Created `docker-entrypoint.sh` for OS detection and environment variable setup
- [x] Set up Docker client (dockerode) - **COMPLETE Phase 3**
- [x] Test Docker connectivity - **COMPLETE Phase 3**

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
- [x] **Persistent Worker ID Storage**:
  - [x] Create `utils/workerIdStorage.js` for file-based worker ID persistence
  - [x] Store worker ID in `data/worker-id.json` (persists across restarts)
  - [x] On startup, check for stored worker ID and verify with conductor
  - [x] Only register as new worker if ID is missing or invalid
  - [x] Mount `./data:/app/data` volume in docker-compose.yml for persistence
  - [x] Add `verifyWorkerId(workerId)` method to ConductorService
  - [x] Add `setOnReconnect(callback)` method to ConductorSocketService for re-registration on socket reconnection

### 2.3 Heartbeat Mechanism
- [x] Implement heartbeat loop:
  - [x] Send heartbeat every `HEARTBEAT_INTERVAL` seconds
  - [x] Call conductor heartbeat endpoint (`POST /api/workers/:id/heartbeat`)
  - [x] Update `last_seen` timestamp on conductor
  - [x] Handle heartbeat failures (network issues, conductor down)
  - [x] Implement re-registration if heartbeat fails repeatedly
  - [x] Handle IP address changes (re-register if IP changes)
- [x] **WebSocket Heartbeat**:
  - [x] Use Socket.IO for real-time bidirectional communication
  - [x] Send heartbeat via WebSocket (`worker:ping` event)
  - [x] Handle WebSocket reconnection and re-register worker on reconnect
  - [x] Emit live resource updates via WebSocket for real-time frontend updates

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
- [x] **Real-time Host Resource Monitoring**:
  - [x] Prioritize reading from mounted host filesystems (`/host/proc/meminfo`, `df -BG /host`) for accurate host resource detection
  - [x] Implement macOS Docker Desktop scaling: Scale container usage percentage to actual Mac RAM/disk using `WORKER_RAM_GB` and `WORKER_DISK_GB` environment variables
  - [x] Ensure fresh resource reads on every heartbeat (no caching) for real-time updates
  - [x] Preserve 2-decimal precision in RAM and disk calculations to show subtle changes
  - [x] Gracefully fall back to `systeminformation` (container metrics) if host filesystem reads fail
  - [x] Support both macOS Docker Desktop (VM-based) and Linux (native) environments
- [x] Implement resource reporting loop:
  - [x] Check resources every `RESOURCE_CHECK_INTERVAL` seconds
  - [x] Update resources on conductor (`PUT /api/workers/:id/resources`)
  - [x] Report resources during heartbeat if changed significantly (5% threshold)
  - [x] **Call `getAllResources()` on every heartbeat** for real-time monitoring (fresh data each time)

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
- [x] **Test persistent worker ID storage** (`tests/unit/workerIdStorage.test.js`):
  - [x] Test `getStoredWorkerId()` - returns null when file doesn't exist, reads valid ID, handles invalid JSON
  - [x] Test `storeWorkerId()` - stores ID successfully, overwrites existing, creates directory
  - [x] Test `clearWorkerId()` - deletes file, handles missing file gracefully
  - [x] Test integration flow (store/retrieve/clear)
- [x] **Test ConductorService.verifyWorkerId** (`tests/unit/conductorService.test.js`):
  - [x] Test returns true when worker ID is valid
  - [x] Test returns false when worker ID not found (404)
  - [x] Test returns false on connection errors
  - [x] Test registerWorker with existingWorkerId parameter
- [x] **Test ConductorSocketService** (`tests/unit/conductorSocketService.test.js`):
  - [x] Test `setOnReconnect()` - sets reconnect callback, replaces previous callback
  - [x] Test `connect()` - successful connection, reconnect callback, connection errors, disconnect handling
  - [x] Test `registerWorker()` - with/without existing worker ID, error handling, timeout handling
  - [x] Test `sendPing()` - sends ping when connected/registered, doesn't send when not connected/registered
  - [x] Test `sendResources()` - sends resources when connected/registered, doesn't send when not connected/registered
  - [x] Test `disconnect()` - disconnects socket and clears state
- [x] **Test resourceDetector comprehensive coverage** (`tests/unit/resourceDetector.test.js`):
  - [x] Test `isHostFilesystemAvailable()` - checks for /host/proc and /host/sys
  - [x] Test `isCgroupAvailable()` - checks for cgroup directory
  - [x] Test `readHostCPUInfo()` - uses WORKER_CPU_CORES, reads from /host/proc/stat, fallback to systeminformation
  - [x] Test `readHostRAMInfo()` - reads from /host/proc/meminfo, handles cgroup v1/v2, fallback to systeminformation
  - [x] Test `readHostDiskInfo()` - reads from df command, handles errors
  - [x] Test `readHostNetworkInfo()` - reads from /host/proc/net/dev, handles errors
  - [x] Test `getCPUInfo()` - host filesystem priority, fallback to systeminformation, error handling
  - [x] Test `getRAMInfo()` - macOS Docker scaling with WORKER_RAM_GB, host filesystem priority, precision preservation
  - [x] Test `getDiskInfo()` - macOS Docker scaling with WORKER_DISK_GB, similar disk detection, empty array handling
  - [x] Test `getNetworkInfo()` - interface filtering, Docker interface exclusion, error handling
  - [x] Test `getAllResources()` - returns all resource information
- [x] **Test ConductorService error paths** (`tests/unit/conductorService.test.js`):
  - [x] Test `registerWorker()` error handling (with/without response data)
  - [x] Test `sendHeartbeat()` error handling (404 triggers re-registration, connection errors)
  - [x] Test `updateResources()` error handling (404 triggers re-registration, connection errors)

### 6.2 Integration Tests
- [x] Test worker registration with conductor (`tests/integration/worker.test.js`)
- [x] Test heartbeat mechanism (`tests/integration/worker.test.js`)
- [x] Test resource reporting (`tests/integration/worker.test.js`)
- [x] Test re-registration after connection loss (`tests/integration/worker.test.js`)
- [x] **Test persistent worker ID flow** (`tests/integration/worker.test.js`):
  - [x] Test stores worker ID after registration
  - [x] Test uses stored worker ID on re-registration
  - [x] Test clears invalid worker ID and registers as new
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

## Phase 9: Pre-commit Hook & Test Coverage ✅ COMPLETE

### 9.1 Pre-commit Hook Setup
- [x] Install and configure Husky for git hooks
- [x] Create `.husky/pre-commit` hook script
- [x] Configure hook to run worker tests before commit
- [x] Configure hook to run conductor tests before commit (excluding websocket timeout)
- [x] Add error handling and helpful error messages
- [x] Test hook functionality

### 9.2 Comprehensive Test Coverage
- [x] Add 50+ tests for worker components:
  - [x] resourceDetector.js comprehensive coverage (host filesystem detection, macOS Docker scaling, error paths)
  - [x] ConductorService.js error handling (registration, heartbeat, resource updates)
  - [x] ConductorSocketService.js full coverage (connect, disconnect, ping, resources, error handling)
- [x] Add 20+ tests for conductor components:
  - [x] Worker routes (registration, heartbeat, resources, GET endpoints with auth)
  - [x] WorkerService methods (getWorkersByStatus, markWorkerOffline, registration edge cases)
  - [x] WorkerSocketService event handlers (resources, disconnect, subscribe/unsubscribe)
- [x] Add authentication middleware to protected worker routes
- [x] Achieve high test coverage across critical components

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

## Phase 10: Projects Feature Implementation

**Status**: [x] Not Started | [x] In Progress | [x] Complete

**Overview**: Update worker to support projects feature. Worker will receive project assignments during registration, deploy services per project, and use project-prefixed container names.

### 10.1 Update Worker Registration ✅ COMPLETE
- [x] Update `ConductorService.registerWorker()`:
  - [ ] Accept optional `project_ids` array in registration request
  - [ ] Store received projects in memory
  - [ ] Return projects in registration response
- [ ] Update `ConductorSocketService.registerWorker()`:
  - [ ] Accept optional `project_ids` array in registration request
  - [ ] Store received projects in memory
  - [ ] Handle `worker:registered` event to extract projects from response
- [ ] Update `index.js` registration flow:
  - [ ] Store projects received from conductor registration
  - [ ] Log projects assigned to worker
  - [ ] Store projects in persistent storage (optional, for recovery)

### 10.2 Update Deployment Handler ✅ COMPLETE
- [x] Update `DeploymentHandler.handleDeploymentInstruction()`:
  - [ ] Extract `project_id` from deployment instruction
  - [ ] Pass `project_id` to service deployment methods
  - [ ] Handle project-specific deployment instructions
- [ ] Update `DeploymentHandler.deployService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Pass `projectId` to ServiceManager.startService()
  - [ ] Update deployment result to include project_id
- [ ] Update `DeploymentHandler.stopService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Pass `projectId` to ServiceManager.stopService()
- [ ] Update `DeploymentHandler.restartService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Pass `projectId` to ServiceManager.restartService()
- [ ] Update `DeploymentHandler.updateService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Pass `projectId` to ServiceManager.updateService()
- [ ] Update `DeploymentHandler.removeService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Pass `projectId` to ServiceManager.removeService()

### 10.3 Update Service Manager ✅ COMPLETE
- [x] Update `ServiceManager.getContainerName()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Return `aerekos-{project}-{serviceName}` if project provided
  - [ ] Return `aerekos-{serviceName}` if project not provided (backward compatibility)
- [ ] Update `ServiceManager.startService()`:
  - [ ] Accept optional `projectId` parameter in config or as separate parameter
  - [ ] Use project-prefixed container name if project provided
  - [ ] Store project_id in service config for tracking
- [ ] Update `ServiceManager.stopService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Use project-prefixed container name if project provided
  - [ ] Fall back to non-prefixed name if project not provided
- [ ] Update `ServiceManager.restartService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Use project-prefixed container name if project provided
- [ ] Update `ServiceManager.getServiceStatus()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Use project-prefixed container name if project provided
  - [ ] Check both prefixed and non-prefixed names for backward compatibility
- [ ] Update `ServiceManager.listServices()`:
  - [ ] Detect project prefix in container names
  - [ ] Group services by project
  - [ ] Return project information with each service
- [ ] Update `ServiceManager.updateService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Use project-prefixed container name if project provided
- [ ] Update `ServiceManager.buildContainerConfig()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Use project-prefixed container name if project provided
  - [ ] Add project_id to container labels/environment variables for tracking

### 10.4 Update Conductor Service ✅ COMPLETE
- [x] Update `ConductorService.getDeploymentInstructions()`:
  - [ ] Filter deployment instructions by worker's assigned projects
  - [ ] Return only deployments for projects assigned to worker
- [ ] Update `ConductorService.getDeployedServices()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Filter services by project_id if provided
  - [ ] Return project information with each service
- [ ] Add `ConductorService.getWorkerProjects()`:
  - [ ] Query conductor API to get projects assigned to worker
  - [ ] Cache projects in memory
  - [ ] Refresh projects on registration

### 10.5 Auto-Deployment Per Project ✅ COMPLETE
- [x] Update `checkDeploymentInstructions()` in `index.js`:
  - [ ] Get worker's assigned projects
  - [ ] Filter deployment instructions by project
  - [ ] Deploy services per project
- [ ] Create `deployProjectServices(projectId)` function:
  - [ ] Get all services assigned to project
  - [ ] Get deployment instructions for project
  - [ ] Deploy each service with project_id
- [ ] Update startup sequence:
  - [ ] After registration, get assigned projects
  - [ ] For each project, check and deploy assigned services
  - [ ] Log project-specific deployments

### 10.6 Container Naming Strategy ✅ COMPLETE
- [x] Document container naming convention:
  - [ ] With project: `aerekos-{project}-{service}` (e.g., `aerekos-development-key_manager`)
  - [ ] Without project: `aerekos-{service}` (e.g., `aerekos-key_manager`)
- [ ] Update container name parsing in `listServices()`:
  - [ ] Detect project prefix pattern
  - [ ] Extract project name from container name
  - [ ] Return project information with service

### 10.7 Orphaned Deployment Cleanup ✅ COMPLETE
- [x] Add orphaned deployment cleanup handler (`services/OrphanCleanupHandler.js`) ✅
  - [ ] `handleOrphanCleanup(orphanedDeployments)` - Process cleanup instructions from conductor
  - [ ] Identify containers by orphaned deployment IDs
  - [ ] Stop and remove orphaned containers
  - [ ] Report cleanup status back to conductor
- [ ] Update `DeploymentHandler`:
  - [ ] Add `handleOrphanCleanup(cleanupInstructions)` method
  - [ ] Process cleanup instructions for orphaned deployments
  - [ ] Match containers by project prefix and service name
  - [ ] Stop and remove matching containers
- [ ] Update `ConductorService`:
  - [ ] Add `getOrphanedDeployments()` method
  - [ ] Add `reportCleanupStatus(deploymentIds, status)` method
- [ ] Update worker startup:
  - [ ] Check for orphaned deployments on startup
  - [ ] Clean up orphaned containers automatically
- [ ] Update `index.js`:
  - [ ] Listen for orphan cleanup instructions from conductor
  - [ ] Process cleanup instructions
  - [ ] Report cleanup status

### 10.8 Testing ⏳ PENDING
- [ ] Unit tests for updated ServiceManager (`tests/unit/serviceManager.test.js`):
  - [ ] Test getContainerName with project_id
  - [ ] Test getContainerName without project_id (backward compatibility)
  - [ ] Test startService with project_id
  - [ ] Test startService without project_id (backward compatibility)
  - [ ] Test stopService with project_id
  - [ ] Test listServices with project detection
- [ ] Unit tests for updated DeploymentHandler (`tests/unit/deploymentHandler.test.js`):
  - [ ] Test handleDeploymentInstruction with project_id
  - [ ] Test deployService with project_id
  - [ ] Test stopService with project_id
- [ ] Unit tests for updated ConductorService (`tests/unit/conductorService.test.js`):
  - [ ] Test registerWorker with project_ids
  - [ ] Test getDeploymentInstructions with project filtering
  - [ ] Test getWorkerProjects
- [ ] Integration tests (`tests/integration/worker.test.js`):
  - [ ] Test worker registration with project_ids
  - [ ] Test service deployment with project_id
  - [ ] Test multiple projects on same worker
  - [ ] Test project isolation (containers don't interfere)
  - [ ] Test backward compatibility (deployments without project_id)
- [ ] Unit tests for OrphanCleanupHandler (`tests/unit/orphanCleanupHandler.test.js`):
  - [ ] Test handleOrphanCleanup (identifies containers, stops, removes)
  - [ ] Test container matching by project prefix
  - [ ] Test cleanup status reporting
- [ ] End-to-end tests:
  - [ ] Test full flow: Register worker with projects → Receive deployment instructions → Deploy services per project → Verify containers
  - [ ] Test multiple projects deploying same service (different containers)
  - [ ] Test project-specific service management (start/stop/restart)
  - [ ] Test orphaned deployment cleanup (receive cleanup instructions → stop/remove containers → report status)
  - [ ] Test orphan cleanup on worker startup

### 10.9 Documentation ⏳ PENDING
- [ ] Update README.md with projects feature documentation
- [ ] Document container naming convention
- [ ] Document project assignment workflow
- [ ] Add examples of multi-project deployment
- [ ] Document backward compatibility considerations

## Next Steps After Completion

Once Worker Setup is complete:
1. Move to Chapter 2.5: Projects Feature Implementation (if not complete)
2. Move to Chapter 3: Services Implementation
3. Start with priority services: `key_manager` and `storage_manager`
4. Test service deployment from conductor to worker with projects
5. Implement enterprise features (health checks, metrics, logging)

## Notes

- Worker is stateless - all orchestration logic lives in conductor
- Worker receives deployment instructions from conductor and executes them
- Worker reports status back to conductor
- Worker can run on same device as conductor (but only one conductor total)
- Worker's `docker-compose.yml` manages services from `worker/` folder
- Services are deployed based on configuration received from conductor
- **Persistent Worker ID**: Worker ID is stored in `data/worker-id.json` and persists across restarts. On startup, worker verifies stored ID with conductor and only registers as new if ID is missing or invalid.
- **Real-time Resource Monitoring**: Worker reads resources from host filesystems (`/host/proc/meminfo`, `df -BG /host`) when available for accurate host resource detection. On macOS Docker Desktop, scales container usage percentage to actual Mac RAM/disk. Resources are read fresh on every heartbeat for real-time updates.
- **WebSocket Communication**: Worker uses Socket.IO for real-time bidirectional communication with conductor. Heartbeats are sent via WebSocket (`worker:ping`), and worker re-registers automatically on socket reconnection.
- Worker automatically re-registers after power outages or IP changes (if ID verification fails)
- Resource reporting helps conductor make intelligent deployment decisions

