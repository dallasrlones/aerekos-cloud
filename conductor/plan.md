# Conductor Implementation Plan

## ✅ STATUS: COMPLETE

**Backend:** All phases complete! All 96 tests passing (excluding websocket timeout).
**Frontend:** Phase 7 complete - Core UI components, navigation, device management, ServerVisual, and real-time WebSocket updates complete.
**Testing:** Comprehensive test coverage with pre-commit hook integration.

## Overview

This plan details the implementation of the conductor (master orchestrator) for aerekos-cloud. The conductor manages all workers, services, authentication, and provides the primary API for third-party applications.

**Follow**: [../plan.md](../plan.md) for high-level roadmap and architecture overview.

## Phase 1: Initial Setup & Configuration ✅ COMPLETE

### 1.1 Environment Configuration
- [x] Create `.env_example` file with all required environment variables
- [ ] Create `.env` file (gitignored) for actual configuration - **USER ACTION NEEDED**
- [x] Set up environment variable loading (dotenv)

### 1.2 Project Structure
- [x] Set up folder structure:
  - `api/services/` - Business logic layer
  - `api/repos/` - Data access layer
  - `api/routes/` - API routes
  - `api/middleware/` - Express middleware
  - `api/utils/` - Utility functions
  - `data/` - SQLite database storage
- [x] Create `package.json` with dependencies
- [x] Install dependencies: express, dotenv, bcrypt, jsonwebtoken, cors, better-sqlite3, bcryptjs, axios

### 1.3 Express Server Setup
- [x] Create Express.js server in `index.js`
- [x] Set up basic middleware (cors, json parser, urlencoded)
- [x] Set up error handling middleware
- [x] Configure port from environment variable
- [x] Add request logging middleware

### 1.4 Docker Setup
- [x] Create `docker-compose.yml` for conductor
- [x] Configure SQLite volume mounting (`./data:/app/data`)
- [x] Set up environment variables in docker-compose
- [x] Configure network settings
- [x] Add health check configuration

## Phase 2: Database Setup ✅ COMPLETE

### 2.1 Database Connection
- [x] Set up database connection using npm package `aerekos-record`
- [x] Connect to SQLite database
- [x] Create database initialization script
- [x] Ensure database directory exists (`data/` folder)
- [x] Fix SQLite adapter verbose option issue
- [x] Fix attachmentEnhancer import (destructure export)

### 2.2 Database Models
- [x] Create `User` model:
  - username (string, unique, required)
  - password_hash (string, required)
  - email (string, unique, required)
  - role (string, default: 'user')
  - timestamps (created_at, updated_at)
- [x] Create `Worker` model:
  - hostname (string)
  - ip_address (string)
  - status (string: online/offline/degraded)
  - last_seen (datetime)
  - resources (JSON: CPU, RAM, disk, network)
  - timestamps
- [x] Create `Service` model:
  - name (string, unique, required)
  - enabled (boolean, default: false)
  - docker_image (string)
  - config (JSON)
  - timestamps
- [x] Create `ServiceDeployment` model:
  - service_id (belongsTo Service)
  - worker_id (belongsTo Worker)
  - status (string: deployed/running/stopped/failed)
  - deployed_at (datetime)
  - timestamps
- [x] Create `Token` model:
  - token (string, unique, required)
  - expires_at (datetime, optional)
  - active (boolean, default: true)
  - timestamps
- [x] Create `Resource` model:
  - worker_id (belongsTo Worker)
  - cpu_cores (number)
  - ram_gb (number)
  - disk_gb (number)
  - network_mbps (number)
  - timestamps

### 2.3 Database Initialization
- [x] Create database initialization script
- [x] Ensure all tables are created on startup
- [x] Fix belongsTo array support in SQLite adapter (multiple foreign keys)
- [x] Fix aerekos-storage/attachmentEnhancer import issue
- [ ] Add database migration support (future enhancement)

## Phase 3: Authentication Foundation ✅ COMPLETE

### 3.1 Password Hashing Utility
- [x] Create password hashing utility (`api/utils/password.js`)
- [x] Implement `hashPassword(password)` function using bcrypt
- [x] Implement `comparePassword(password, hash)` function
- [x] Add salt rounds configuration

### 3.2 JWT Service
- [x] Create JWT service (`api/services/JWTService.js`)
- [x] Implement `generateToken(user)` - creates JWT with user info
- [x] Implement `verifyToken(token)` - verifies and decodes JWT
- [x] Configure JWT secret and expiration from environment
- [ ] Add token refresh logic (if needed) - future enhancement

### 3.3 User Service & Repository
- [x] Create `UserRepository` (`api/repos/UserRepository.js`):
  - [x] `findByUsername(username)`
  - [x] `findById(id)`
  - [x] `create(userData)`
  - [x] `update(id, userData)`
  - [x] `findAll()`
  - [x] `findByEmail(email)`
- [x] Create `UserService` (`api/services/UserService.js`):
  - [x] `authenticate(username, password)` - validates credentials
  - [x] `getCurrentUser(userId)` - gets user info
  - [x] `createUser(userData)` - creates new user (for seeding)
  - [x] Keep code DRY, separate concerns

### 3.4 User Seeding
- [x] Create user seeding script (`scripts/seedUsers.js`)
- [x] Seed initial admin user(s)
- [x] Hash passwords before storing
- [x] Run seeding on conductor startup (if no users exist in development)

## Phase 4: Authentication Endpoints & Middleware ✅ COMPLETE

### 4.1 Authentication Middleware
- [x] Create authentication middleware (`api/middleware/auth.js`)
- [x] Extract JWT token from Authorization header
- [x] Verify token using JWT service
- [x] Attach user to request object
- [x] Handle authentication errors

### 4.2 Authentication Routes
- [x] Create auth routes (`api/routes/auth.js`)
- [x] `POST /api/auth/login`:
  - [x] Accept username and password
  - [x] Validate credentials via UserService
  - [x] Generate JWT token
  - [x] Return token and user info
- [x] `GET /api/auth/me` (protected):
  - [x] Get current user from JWT
  - [x] Return user info
- [x] `POST /api/auth/logout` (optional):
  - [x] Client-side token removal (basic implementation)

## Phase 5: Conductor Token Generation ✅ COMPLETE

### 5.1 Token Service & Repository
- [x] Create `TokenRepository` (`api/repos/TokenRepository.js`):
  - [x] `findActiveToken()`
  - [x] `createToken(tokenData)` (via `create`)
  - [x] `invalidateToken(token)`
  - [x] `invalidateAllTokens()`
- [x] Create `TokenService` (`api/services/TokenService.js`):
  - [x] `generateRegistrationToken()` - creates secure token for worker registration
  - [x] `validateToken(token)` - validates worker registration token
  - [x] `getCurrentToken()` - gets active registration token
  - [x] `regenerateToken()` - creates new token, invalidates old

### 5.2 Token Generation on Startup
- [x] Generate registration token on conductor startup
- [x] Store token in database
- [x] If token exists and is valid, use existing token
- [x] If no token or expired, generate new token

### 5.3 Token API Endpoints
- [x] Create token routes (`api/routes/token.js`)
- [x] `GET /api/token` (protected):
  - [x] Return current registration token
- [x] `POST /api/token/regenerate` (protected):
  - [x] Generate new token
  - [x] Invalidate old token
  - [x] Return new token

## Phase 6: Health Check & Basic API ✅ COMPLETE

### 6.1 Health Check Endpoint
- [x] Create health check endpoint `GET /health`
- [x] Check database connectivity (added DB check)
- [x] Return service status
- [x] Return 200 if healthy, 503 if unhealthy

### 6.2 Basic API Structure
- [x] Set up route organization (basic structure in place)
- [x] Create API versioning (`/api/v1/...`) - routes available at both `/api/v1/*` and `/api/*` for backward compatibility
- [x] Add request ID middleware for correlation (`api/middleware/requestId.js`)
- [x] Add structured logging middleware (includes request ID in logs)

## Phase 7: Frontend Setup (Early Priority)

**Note**: Frontend implementation will be done separately. The backend API is complete and ready for frontend integration.

### 7.1 React Native Project Setup
- [x] Initialize React Native project (Expo recommended)
- [x] Configure web build (React Native Web/Expo Web)
- [x] Set up project structure:
  - `components/` - Reusable UI components ✅
  - `hooks/` - Custom hooks (useAuth via AuthContext) ✅
  - `styles/` - Global styles and themes ✅
  - `utils/` - Utility functions ✅
  - `screens/` - Screen components ✅
  - `services/` - API service layer ✅

### 7.2 API Client Setup
- [x] Create API client service (`utils/api.js`)
- [x] Configure base URL from environment
- [x] Add JWT token handling (store, attach to requests)
- [x] Add request/response interceptors
- [x] Handle errors consistently

### 7.3 Authentication Context
- [x] Create authentication context (`contexts/AuthContext.js`)
- [x] Create `useAuth` hook
- [x] Manage JWT token storage (AsyncStorage)
- [x] Handle login/logout state
- [x] Provide user info to app

### 7.4 Login Screen
- [x] Create login screen (`screens/Login.jsx`)
- [x] Username/password form
- [x] Handle form submission
- [x] Call login API
- [x] Store JWT token
- [x] Redirect to dashboard on success
- [x] Show error messages
- [x] Use Assassin's Creed-inspired dark theme

### 7.5 Basic Dashboard
- [x] Create dashboard layout (`screens/Dashboard.jsx`)
- [x] Create navigation structure (conditional rendering based on auth)
- [x] Add health check status display
- [x] Add "No workers" empty state
- [x] Add "No services" empty state
- [x] Basic styling with dark theme

### 7.6 Dockerization
- [x] Create Dockerfile for frontend (multi-stage build with nginx)
- [x] Create nginx configuration
- [x] Update docker-compose.yml to include frontend service
- [x] Configure environment variables
- [x] Set up health checks

### 7.7 Settings Page
- [x] Create Settings screen component (`screens/Settings/Settings.jsx`)
- [x] Add password reset form with validation
- [x] Add password reset API endpoint (`POST /api/auth/reset-password`)
- [x] Add `updatePassword` method to UserService
- [x] Add `resetPassword` method to authService (frontend)
- [x] Add profile update API endpoint (`PUT /api/auth/profile`)
- [x] Add `updateProfile` method to UserService (username and email)
- [x] Add `updateProfile` method to authService (frontend)
- [x] Add username and email editing forms in Settings
- [x] Add validation for username (min 3 chars) and email format
- [x] Add duplicate checking for username and email
- [x] Add navigation from Dashboard to Settings
- [x] Add back navigation from Settings to Dashboard
- [x] Style Settings page with Assassin's Creed-inspired theme

### 7.8 Global Header Component
- [x] Create Header component (`components/Header/Header.jsx`)
- [x] Add home icon (left) - navigates to dashboard
- [x] Add search bar (center) - placeholder for future search functionality
- [x] Add notification icon (right) - placeholder for notifications
- [x] Add settings/gear icon (right) - navigates to settings
- [x] Add burger menu icon (far right) - navigates to menu
- [x] Style header with Assassin's Creed-inspired theme
- [x] Integrate header into App.js (shows on all authenticated screens)
- [x] Add active state highlighting for current screen icons

### 7.9 Menu Screen
- [x] Create Menu screen component (`screens/Menu/Menu.jsx`)
- [x] Add user info display (username and email)
- [x] Add Sign Out menu item with icon
- [x] Integrate logout functionality from AuthContext
- [x] Add back navigation button
- [x] Style menu with Assassin's Creed-inspired theme
- [x] Add navigation from Header burger menu to Menu screen

### 7.10 URL-Based Routing
- [x] Implement URL-based routing for web platform
- [x] Map `/` to Dashboard screen
- [x] Map `/settings` to Settings screen
- [x] Map `/menu` to Menu screen
- [x] Sync URL with screen state on navigation
- [x] Handle browser back/forward navigation
- [x] Initialize screen from URL on mount
- [x] Update URL when navigating between screens

### 7.11 Development Tools
- [x] Set up nodemon for API auto-restart (`nodemon.json`)
- [x] Configure nodemon to watch `api/`, `index.js`, and `scripts/` directories
- [x] Create `Dockerfile.dev` for development with nodemon
- [x] Update docker-compose.yml to use Dockerfile.dev
- [x] Mount code directories as volumes for hot reload
- [x] Document nodemon usage in README.md

### 7.12 Worker Registration Improvements
- [x] Update worker registration endpoint to detect IP/hostname from request
- [x] Add `trust proxy` setting to Express for accurate IP detection
- [x] Remove requirement for worker to send IP/hostname in registration request
- [x] Conductor detects IP from `X-Forwarded-For`, `req.ip`, or `req.connection.remoteAddress`
- [x] Conductor detects hostname from request headers or uses IP as fallback
- [x] Worker stores IP/hostname in memory only (returned by conductor)

### 7.13 Devices Management UI
- [x] Create deviceService (`services/deviceService.js`) for API calls
- [x] Create Devices list screen (`screens/Devices/Devices.jsx`)
  - [x] Display all registered devices/workers
  - [x] Show device status (online/offline/degraded) with color coding
  - [x] Show device resources (CPU, RAM, disk)
  - [x] Show last seen timestamp
  - [x] Add pull-to-refresh functionality
  - [x] Navigate to device details on tap
- [x] Create Device Details screen (`screens/DeviceDetails/DeviceDetails.jsx`)
  - [x] Display device information (hostname, IP, status, ID)
  - [x] Display device resources (CPU, RAM, disk, network)
  - [x] Display registration and last seen timestamps
  - [x] Add pull-to-refresh functionality
  - [x] Listen for `worker:live:update` WebSocket events for real-time resource updates
  - [x] Display live resource graphs (CPU, RAM, Disk, Network) using Chart components
- [x] **ServerVisual Component** (`components/ServerVisual/ServerVisual.jsx`):
  - [x] Create futuristic 3D server visualization component
  - [x] Display device details in LCD-style displays (NAME, CPU, RAM, DISK, NET)
  - [x] Show real-time status LED (online/offline/degraded)
  - [x] Use light grey background with grey text and thin futuristic font (Assassin's Creed-inspired)
  - [x] Support both web (CSS 3D transforms) and React Native (2D transforms)
  - [x] Integrate ServerVisual into Device Details screen
- [x] **WebSocket Live Updates**:
  - [x] Emit `worker:live:update` event from `WorkerSocketService` on `worker:ping` heartbeat
  - [x] Include detailed resource data (CPU, RAM, Disk, Network) in live update events
  - [x] Frontend listens for live updates and updates Device Details screen in real-time
- [x] Add registration token display to Dashboard
  - [x] Show token with hide/show toggle (eye icon)
  - [x] Display token hint text
  - [x] Load token on dashboard mount
- [x] Update App.js routing to support `/devices` and `/devices/:id` paths
- [x] Add link from Dashboard to Devices screen

## Phase 8: Testing ✅ COMPLETE

### 8.1 Unit Tests
- [x] Test UserService methods
- [x] Test UserRepository methods
- [x] Test JWTService methods
- [x] Test TokenService methods
- [x] Test password hashing utility
- [x] Test UserService.updatePassword method
- [x] Test UserService.updateProfile method

### 8.2 Integration Tests
- [x] Test authentication endpoints
- [x] Test token endpoints
- [x] Test health check endpoint
- [x] Test database operations
- [x] Created comprehensive test suite with Jest and Supertest
- [x] Test files: `tests/integration/api.test.js`, `tests/integration/auth.test.js`, `tests/integration/token.test.js`, `tests/integration/database.test.js`
- [x] **80/80 tests passing ✅** (5 test suites, 80 tests total)
- [x] Fixed SQLite boolean handling (using integers 0/1)
- [x] Fixed test cleanup and isolation
- [x] Fixed health check database connectivity check
- [x] Fixed test user creation and authentication
- [x] Added `ensureTestUser()` helper for better test isolation
- [x] Fixed unique constraint test error handling
- [x] Test password reset endpoint (`POST /api/auth/reset-password`)
- [x] Test profile update endpoint (`PUT /api/auth/profile`)
- [x] Test password reset with invalid current password
- [x] Test password reset with weak new password
- [x] Test password reset requires both passwords
- [x] Test password reset requires authentication
- [x] Test profile update with duplicate username
- [x] Test profile update with duplicate email
- [x] Test profile update with invalid email format
- [x] Test profile update with short username
- [x] Test profile update requires at least one field
- [x] Test profile update requires authentication
- [x] **Test WebSocket live updates** (`tests/integration/websocket.test.js`):
  - [x] Test worker registration via WebSocket
  - [x] Test worker registration with existing worker ID via WebSocket
  - [x] Test `worker:live:update` event emission on `worker:ping` with resources
  - [x] Test `worker:resources:updated` broadcast to all frontend clients
  - [x] Test `worker:resources` event handling
  - [x] Test worker disconnect and offline marking
  - [x] Test `worker:subscribe` and `worker:unsubscribe` events
- [x] **Test WorkerService methods** (`tests/integration/api.test.js`):
  - [x] Test `getWorkersByStatus()` method
  - [x] Test `markWorkerOffline()` method
  - [x] Test worker registration with existing worker by hostname
  - [x] Test worker registration with existing worker by IP
  - [x] Test registration with invalid existing worker ID
- [x] **Test Worker Routes** (`tests/integration/api.test.js`):
  - [x] Test POST `/api/workers/register` with valid token
  - [x] Test POST `/api/workers/register` with existing worker_id
  - [x] Test POST `/api/workers/register` IP/hostname detection
  - [x] Test POST `/api/workers/register` validation (missing token, invalid token)
  - [x] Test POST `/api/workers/:id/heartbeat` success and 404 cases
  - [x] Test PUT `/api/workers/:id/resources` success, validation, and 404 cases
  - [x] Test GET `/api/workers` with authentication
  - [x] Test GET `/api/workers/:id` with authentication and 404 cases
  - [x] Test authentication middleware on protected routes

### 8.3 Test infrastructure
- [x] Global setup (`tests/globalSetup.js`) - runs once before all tests
- [x] Global teardown (`tests/globalTeardown.js`) - runs once after all tests
- [x] Test helpers (`tests/helpers/dbHelper.js`) - database utilities
- [x] Test utilities (`tests/helpers/testHelpers.js`) - general test utilities
- [x] Proper test isolation with `beforeAll`, `afterAll`, `afterEach` hooks
- [x] Test database cleanup between test suites
- [x] Helper functions for creating test data (users, workers, services, tokens)
- [x] Configured Jest to run tests serially (`maxWorkers: 1`) to prevent database lock issues
- [x] Fixed all test isolation issues - all 48 tests pass when run together

## Dependencies

**Required npm packages**:
- express
- dotenv
- bcrypt
- jsonwebtoken
- cors
- sqlite3 (via aerekos-record)

**Follow**:
- [../backend_guidelines.md](../backend_guidelines.md) for coding standards
- [../testing_guidelines.md](../testing_guidelines.md) for testing practices

## ✅ Conductor Implementation Status

**Backend:** Phases 1-6 complete, Phase 8 complete! All 96 tests passing ✅
**Frontend:** Phase 7 complete - Core UI components, navigation, device management, ServerVisual, and real-time WebSocket updates ✅
**Testing:** Comprehensive test coverage with pre-commit hook integration ✅

### Backend (Phases 1-6, 8)
- ✅ **96/96 tests passing** (5 test suites, 96 tests total, excluding websocket timeout)
- ✅ All API endpoints working and tested
- ✅ Database models created and tested
- ✅ Authentication system complete
- ✅ Token generation working
- ✅ Password reset endpoint (`POST /api/auth/reset-password`) implemented and tested
- ✅ Profile update endpoint (`PUT /api/auth/profile`) implemented and tested
- ✅ Health checks implemented with database connectivity
- ✅ Request ID middleware added for correlation tracking
- ✅ API versioning in place (`/api/v1/*` and `/api/*`)
- ✅ Test harness (global setup/teardown) for Jest
- ✅ Test helpers and utilities created
- ✅ All test isolation issues resolved
- ✅ All new endpoints fully tested (password reset and profile update)
- ✅ Worker routes fully tested (registration, heartbeat, resources, GET endpoints)
- ✅ WorkerService methods fully tested (getWorkersByStatus, markWorkerOffline, registration edge cases)
- ✅ WorkerSocketService event handlers tested (resources, disconnect, subscribe/unsubscribe)
- ✅ Authentication middleware added to protected worker routes
- ✅ Pre-commit hook integration for automated testing
- ✅ Docker configuration ready
- ✅ README.md created

### Frontend (Phase 7)
- ✅ React Native Expo project initialized
- ✅ Project structure set up (components, screens, services, styles, utils)
- ✅ API client with JWT handling
- ✅ Authentication context and useAuth hook
- ✅ Login screen with Assassin's Creed dark theme
- ✅ Dashboard with health check status
- ✅ Global Header component with navigation icons
- ✅ Settings page with password reset and profile editing (username/email)
- ✅ Menu screen with sign out functionality
- ✅ URL-based routing for web (`/`, `/settings`, `/menu`, `/devices`, `/devices/:id`)
- ✅ Browser navigation support (back/forward buttons)
- ✅ **Devices Management UI**: Devices list screen and Device Details screen
- ✅ **ServerVisual Component**: Futuristic 3D server visualization with LCD-style displays
- ✅ **WebSocket Live Updates**: Real-time resource updates via `worker:live:update` events
- ✅ Live resource graphs (CPU, RAM, Disk, Network) on Device Details screen
- ✅ Dockerized with multi-stage build (nginx)
- ✅ Docker Compose integration
- ✅ Environment variable configuration
- ✅ Nodemon setup for API development with auto-restart

## Phase 9: Projects Feature Implementation

**Status**: [x] Not Started | [x] In Progress | [x] Complete ✅

**Overview**: Add Projects as a global parent to all services and devices. Projects enable multi-tenancy where a single worker can host multiple projects (e.g., "development" and "production"), each with its own services and devices.

### 9.1 Database Models ✅ COMPLETE
- [x] Create `Project` model (`api/models/index.js`):
  - [ ] `name` (string, unique, required) - Project name (e.g., "development", "production")
  - [ ] `description` (string, optional) - Project description
  - [ ] `enabled` (number, default: 1) - 0 = false, 1 = true
  - [ ] `config` (string, JSON) - Project-specific configuration
  - [ ] `timestamps` (created_at, updated_at)
- [ ] Create `ProjectWorker` join table model:
  - [ ] `project_id` (belongsTo Project)
  - [ ] `worker_id` (belongsTo Worker)
  - [ ] `timestamps` (created_at, updated_at)
  - [ ] Unique constraint on (project_id, worker_id)
- [ ] Create `ProjectService` join table model:
  - [ ] `project_id` (belongsTo Project)
  - [ ] `service_id` (belongsTo Service)
  - [ ] `timestamps` (created_at, updated_at)
  - [ ] Unique constraint on (project_id, service_id)
- [ ] Update `ServiceDeployment` model (`api/models/index.js`):
  - [ ] Add `orphaned` field (number, default: 0) - Flag for orphaned deployments after project deletion
  - [ ] Add `project_id` to belongsTo array: `belongsTo: ['Service', 'Worker', 'Project']` (Project is optional - can be NULL for backward compatibility)
  - [ ] Update unique constraint to include project_id (project_id, service_id, worker_id) - Note: project_id can be NULL
  - [ ] Add index on `orphaned` for efficient cleanup queries
- [ ] Create database migration script or update `api/utils/dbInit.js` to create new tables
- [ ] Update test helpers (`tests/helpers/dbHelper.js`) to clean up Project, ProjectWorker, ProjectService tables

### 9.2 Project Repository ✅ COMPLETE
- [x] Create `ProjectRepository` (`api/repos/ProjectRepository.js`):
  - [ ] `findAll(options)` - Get all projects with optional filters
  - [ ] `findById(id)` - Get project by ID
  - [ ] `findByName(name)` - Get project by name
  - [ ] `create(projectData)` - Create new project
  - [ ] `update(id, projectData)` - Update project
  - [ ] `delete(id)` - Delete project
  - [ ] `getWorkers(projectId)` - Get all workers assigned to a project
  - [ ] `getServices(projectId)` - Get all services assigned to a project
  - [ ] `assignWorker(projectId, workerId)` - Assign worker to project
  - [ ] `unassignWorker(projectId, workerId)` - Unassign worker from project
  - [ ] `assignService(projectId, serviceId)` - Assign service to project
  - [ ] `unassignService(projectId, serviceId)` - Unassign service from project
  - [ ] `getWorkerProjects(workerId)` - Get all projects for a worker
  - [ ] `getServiceProjects(serviceId)` - Get all projects for a service

### 9.3 Project Service ✅ COMPLETE
- [x] Create `ProjectService` (`api/services/ProjectService.js`):
  - [ ] `createProject(projectData)` - Create new project with validation
    - [ ] **Auto-set as current project if it's the first project created** (check if any projects exist)
  - [ ] `updateProject(id, projectData)` - Update project with validation
  - [ ] `deleteProject(id)` - **Transactional project deletion**:
    - [ ] Start database transaction
    - [ ] Find all ServiceDeployments for project
    - [ ] Flag deployments as orphaned (add `orphaned: true` flag or status)
    - [ ] Detach deployments from project (set `project_id` to NULL)
    - [ ] Delete ProjectWorker associations
    - [ ] Delete ProjectService associations
    - [ ] Delete Project record
    - [ ] Commit transaction (or rollback on error)
    - [ ] Send cleanup instructions to all workers for orphaned deployments
    - [ ] Return cleanup job IDs for tracking
  - [ ] `getProject(id)` - Get project with workers and services
  - [ ] `listProjects(options)` - List all projects with optional filters
  - [ ] `assignWorkerToProject(projectId, workerId)` - Assign worker to project
  - [ ] `unassignWorkerFromProject(projectId, workerId)` - Unassign worker from project
  - [ ] `assignServiceToProject(projectId, serviceId)` - Assign service to project
  - [ ] `unassignServiceFromProject(projectId, serviceId)` - Unassign service from project
  - [ ] `getWorkerProjects(workerId)` - Get all projects for a worker
  - [ ] `getServiceProjects(serviceId)` - Get all projects for a service
  - [ ] `getProjectDeployments(projectId)` - Get all deployments for a project
  - [ ] `getOrphanedDeployments()` - Get all orphaned deployments (for cleanup tracking)
  - [ ] `cleanupOrphanedDeployments(workerId)` - Send cleanup instructions to worker for orphaned deployments

### 9.4 Update Worker Service ✅ COMPLETE
- [x] Update `WorkerService.registerWorker()`:
  - [ ] Accept optional `project_ids` array in registration data
  - [ ] Create ProjectWorker associations for assigned projects
  - [ ] Return projects in worker registration response
- [ ] Update `WorkerService.getWorkerProjects(workerId)`:
  - [ ] Query ProjectWorker join table to get all projects for worker
  - [ ] Return array of project objects

### 9.5 Update Service Manager ✅ COMPLETE
- [x] Update `ServiceManager.enableService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] If projectId provided, create ServiceDeployment with project_id
  - [ ] If projectId not provided, create deployment without project (backward compatibility)
  - [ ] Update container naming to include project prefix: `aerekos-{project}-{service}` (if project provided)
  - [ ] Update deployment instruction to include project_id
- [ ] Update `ServiceManager.disableService()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Filter deployments by project_id if provided
- [ ] Update `ServiceManager.getServiceStatus()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Filter deployments by project_id if provided
- [ ] Update `ServiceManager.getServiceInstances()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Filter deployments by project_id if provided
- [ ] Update `ServiceManager.proxyServiceRequest()`:
  - [ ] Accept optional `projectId` parameter
  - [ ] Filter deployments by project_id if provided
  - [ ] Update container name lookup to include project prefix

### 9.6 Project API Routes ✅ COMPLETE
- [x] Create project routes (`api/routes/project.js`):
  - [ ] `GET /api/projects` (protected) - List all projects
  - [ ] `GET /api/projects/:id` (protected) - Get project details
  - [ ] `POST /api/projects` (protected) - Create new project (returns project, indicates if first project)
  - [ ] `PUT /api/projects/:id` (protected) - Update project
  - [ ] `DELETE /api/projects/:id` (protected) - Delete project (transactional, returns cleanup job IDs)
  - [ ] `POST /api/projects/:id/workers/:workerId` (protected) - Assign worker to project
  - [ ] `DELETE /api/projects/:id/workers/:workerId` (protected) - Unassign worker from project
  - [ ] `POST /api/projects/:id/services/:serviceId` (protected) - Assign service to project
  - [ ] `DELETE /api/projects/:id/services/:serviceId` (protected) - Unassign service from project
  - [ ] `GET /api/projects/:id/deployments` (protected) - Get project deployments
  - [ ] `GET /api/workers/:workerId/projects` (protected) - Get all projects for a worker
  - [ ] `GET /api/services/:serviceId/projects` (protected) - Get all projects for a service
  - [ ] `GET /api/deployments/orphaned` (protected) - Get all orphaned deployments (for cleanup tracking)
- [ ] Register project routes in `index.js`
- [ ] Add authentication middleware to all project routes

### 9.7 Update Worker Routes ✅ COMPLETE
- [x] Update `POST /api/workers/register`:
  - [ ] Accept optional `project_ids` array in request body
  - [ ] Create ProjectWorker associations during registration
  - [ ] Return projects in registration response
- [ ] Update `GET /api/workers/:id`:
  - [ ] Include projects in worker response
- [ ] Update `GET /api/workers/:id/deployments`:
  - [ ] Accept optional `project_id` query parameter
  - [ ] Filter deployments by project_id if provided
  - [ ] Return deployments grouped by project

### 9.8 Frontend Updates ✅ COMPLETE
- [x] Create project service (`app/services/projectService.js`) ✅
  - [ ] `getProjects()` - Get all projects
  - [ ] `getProject(id)` - Get project details with workers and services
  - [ ] `createProject(data)` - Create new project
  - [ ] `updateProject(id, data)` - Update project
  - [ ] `deleteProject(id)` - Delete project
  - [ ] `assignWorker(projectId, workerId)` - Assign worker to project
  - [ ] `unassignWorker(projectId, workerId)` - Unassign worker from project
  - [ ] `assignService(projectId, serviceId)` - Assign service to project
  - [ ] `unassignService(projectId, serviceId)` - Unassign service from project
- [ ] Create Project Context (`app/contexts/ProjectContext.jsx`):
  - [ ] Manage current selected project state
  - [ ] Store list of all projects
  - [ ] Provide `useProject` hook
  - [ ] `setCurrentProject(projectId)` - Switch current project
    - [ ] **Show loading spinner while switching**
    - [ ] **Immediately filter views** (don't wait for data fetch)
    - [ ] Fetch project-specific data in background
  - [ ] `getCurrentProject()` - Get current project
  - [ ] `refreshProjects()` - Refresh projects list
  - [ ] Load projects on mount
  - [ ] **Auto-set first project as current** if no current project set
  - [ ] Persist selected project in localStorage/AsyncStorage
  - [ ] `isLoading` state for project switching
- [ ] **Update Header Component** (`app/components/Header/Header.jsx`):
  - [ ] **Add Project Switcher Dropdown** (top left, like GCP):
    - [ ] Replace or add dropdown next to home icon
    - [ ] Display current project name
    - [ ] Dropdown shows list of all projects
    - [ ] Allow switching between projects
    - [ ] Show "Create Project" option in dropdown if no projects exist
    - [ ] Style with Assassin's Creed dark theme
    - [ ] Use Ionicons for dropdown arrow
  - [ ] Keep home icon functionality
  - [ ] Update styles for project switcher
- [ ] **Update Dashboard** (`app/screens/Dashboard/Dashboard.jsx`):
  - [ ] **First-time experience**: Check if projects exist on mount
  - [ ] **If no projects exist**: Show empty state with message and button:
    - [ ] Display message: "You haven't created any projects yet"
    - [ ] Display "Create Project" button (large, prominent)
    - [ ] Navigate to project creation on button press
    - [ ] Style with Assassin's Creed dark theme
  - [ ] **If projects exist**: Show normal dashboard
  - [ ] Filter dashboard content by current project (if project selected)
  - [ ] Show loading spinner while fetching project-specific data
  - [ ] Show current project name in welcome section
  - [ ] Add projects section showing current project info
  - [ ] Add link to Projects screen
- [ ] Create Projects list screen (`app/screens/Projects/Projects.jsx`):
  - [ ] Display all projects
  - [ ] Show project status (enabled/disabled) with color coding
  - [ ] Show project worker count and service count
  - [ ] Show current project indicator (highlighted)
  - [ ] Navigate to project details on tap
  - [ ] Add "Create Project" button (floating action button or header button)
  - [ ] Add pull-to-refresh functionality
  - [ ] Style with Assassin's Creed dark theme
- [ ] Create Project Details screen (`app/screens/ProjectDetails/ProjectDetails.jsx`):
  - [ ] Display project information (name, description, status, created date)
  - [ ] Display assigned workers list (with links to device details)
  - [ ] Display assigned services list (with links to service details)
  - [ ] Display project deployments (recent deployments, deployment history)
  - [ ] Add "Assign Worker" button (opens worker selection modal)
  - [ ] Add "Assign Service" button (opens service selection modal)
  - [ ] Add "Edit Project" button (navigates to edit screen)
  - [ ] Add "Delete Project" button (with confirmation dialog)
  - [ ] Add "Set as Current Project" button (if not already current)
  - [ ] Add pull-to-refresh functionality
  - [ ] Style with Assassin's Creed dark theme
- [ ] Create Project Create/Edit screen (`app/screens/ProjectForm/ProjectForm.jsx`):
  - [ ] Form for creating/editing project
  - [ ] Name field (required, unique validation, min 3 chars)
  - [ ] Description field (optional, text area)
  - [ ] Enabled toggle (default: enabled)
  - [ ] Save button (disabled if form invalid)
  - [ ] Cancel button (navigates back)
  - [ ] Show validation errors inline
  - [ ] **On successful create**: 
    - [ ] **If first project**: Auto-set as current project in ProjectContext
    - [ ] Navigate to project details
  - [ ] On successful edit: Navigate back to project details
  - [ ] Style with Assassin's Creed dark theme
- [ ] Create Project Switcher Component (`app/components/ProjectSwitcher/ProjectSwitcher.jsx`):
  - [ ] Dropdown component for project selection
  - [ ] Display current project name
  - [ ] **Show loading spinner** when switching projects
  - [ ] Dropdown list of all projects
  - [ ] "Create Project" option at bottom of dropdown
  - [ ] Handle project switching
  - [ ] Close dropdown on selection
  - [ ] **Immediately update UI** on selection (optimistic update)
  - [ ] Style with Assassin's Creed dark theme
  - [ ] Use React Native Modal or custom dropdown
- [ ] Update Device Details screen:
  - [ ] Display projects assigned to device
  - [ ] Add "Assign to Project" button (opens project selection modal)
  - [ ] Show project badges/chips for assigned projects
- [ ] Update App.js routing:
  - [ ] Add `/projects` route
  - [ ] Add `/projects/:id` route
  - [ ] Add `/projects/new` route
  - [ ] Add `/projects/:id/edit` route
  - [ ] Wrap app with ProjectContext provider

### 9.9 Testing
- [ ] Unit tests for ProjectRepository (`tests/unit/projectRepository.test.js`):
  - [ ] Test findAll, findById, findByName
  - [ ] Test create, update, delete
  - [ ] Test getWorkers, getServices
  - [ ] Test assignWorker, unassignWorker
  - [ ] Test assignService, unassignService
  - [ ] Test getWorkerProjects, getServiceProjects
- [ ] Unit tests for ProjectService (`tests/unit/projectService.test.js`):
  - [ ] Test createProject (auto-sets as current if first project)
  - [ ] Test updateProject, deleteProject
  - [ ] Test deleteProject (transactional: flags orphaned, detaches, sends cleanup)
  - [ ] Test deleteProject (transaction rollback on error)
  - [ ] Test getProject, listProjects
  - [ ] Test assignWorkerToProject, unassignWorkerFromProject
  - [ ] Test assignServiceToProject, unassignServiceFromProject
  - [ ] Test getWorkerProjects, getServiceProjects
  - [ ] Test getProjectDeployments
  - [ ] Test getOrphanedDeployments
  - [ ] Test cleanupOrphanedDeployments
- [ ] Integration tests for project routes (`tests/integration/project.test.js`):
  - [ ] Test GET /api/projects (list projects)
  - [ ] Test GET /api/projects (empty list when no projects)
  - [ ] Test GET /api/projects/:id (get project)
  - [ ] Test GET /api/projects/:id (404 when project not found)
  - [ ] Test POST /api/projects (create project)
  - [ ] Test POST /api/projects (validation: unique name, required fields)
  - [ ] Test PUT /api/projects/:id (update project)
  - [ ] Test DELETE /api/projects/:id (delete project - transactional)
  - [ ] Test DELETE /api/projects/:id (flags deployments as orphaned)
  - [ ] Test DELETE /api/projects/:id (detaches deployments from project)
  - [ ] Test DELETE /api/projects/:id (sends cleanup instructions to workers)
  - [ ] Test DELETE /api/projects/:id (transaction rollback on error)
  - [ ] Test GET /api/deployments/orphaned (get orphaned deployments)
  - [ ] Test POST /api/projects/:id/workers/:workerId (assign worker)
  - [ ] Test DELETE /api/projects/:id/workers/:workerId (unassign worker)
  - [ ] Test POST /api/projects/:id/services/:serviceId (assign service)
  - [ ] Test DELETE /api/projects/:id/services/:serviceId (unassign service)
  - [ ] Test GET /api/projects/:id/deployments (get deployments)
  - [ ] Test GET /api/workers/:workerId/projects (get worker projects)
  - [ ] Test GET /api/services/:serviceId/projects (get service projects)
  - [ ] Test authentication on all routes
  - [ ] Test validation (unique name, required fields, min length)
- [ ] Integration tests for updated worker routes (`tests/integration/worker.test.js`):
  - [ ] Test worker registration with project_ids
  - [ ] Test worker registration response includes projects
  - [ ] Test GET /api/workers/:id includes projects
  - [ ] Test GET /api/workers/:id/deployments with project_id filter
- [ ] Integration tests for updated service routes (`tests/integration/service.test.js`):
  - [ ] Test service deployment with project_id
  - [ ] Test service deployment without project_id (backward compatibility)
  - [ ] Test service status with project_id filter
  - [ ] Test service instances with project_id filter
- [ ] Frontend component tests:
  - [ ] Test ProjectSwitcher component (dropdown, selection, create option, loading spinner)
  - [ ] Test ProjectContext (state management, project switching with spinner, auto-set first project)
  - [ ] Test Dashboard first-time experience (empty state message and button)
  - [ ] Test ProjectForm (validation, create, edit, auto-set first project as current)
  - [ ] Test ProjectDetails (display, actions, delete with confirmation)
  - [ ] Test Projects list (display, navigation)
  - [ ] Test immediate filter on project switch (optimistic update)
- [ ] End-to-end tests:
  - [ ] Test full flow: Create project → Assign worker → Assign service → Deploy service → Verify deployment
  - [ ] Test multiple projects on same worker
  - [ ] Test project isolation (services from different projects don't interfere)
  - [ ] Test project switching in UI (dropdown, context update, filtered views, loading spinner)
  - [ ] Test first-time experience (no projects → empty state → create project → auto-set as current)
  - [ ] Test project deletion (transactional: orphaned deployments, cleanup instructions)
  - [ ] Test orphaned deployment cleanup on workers

### 9.10 Documentation ⏳ PENDING
- [ ] Update README.md with projects feature documentation
- [ ] Update API documentation with project endpoints
- [ ] Add examples of multi-project deployment
- [ ] Document project assignment workflow
- [ ] Document transactional project deletion process:
  - [ ] Explain orphaned deployment flagging
  - [ ] Explain cleanup instruction flow to workers
  - [ ] Document cleanup job tracking
- [ ] Document first-time experience flow
- [ ] Document project switching behavior (immediate filter with spinner)

---

## Phase 11: Service Orchestration & Auto-Assignment

**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

**Overview**: Implement intelligent service orchestration where conductor automatically assigns services to devices based on worker resources, project requirements, and device-specific constraints. Supports horizontal scaling with load balancing.

### 11.1 Service Assignment Logic
- [x] Create `ServiceOrchestrator` service (`api/services/ServiceOrchestrator.js`):
  - [ ] `findOptimalWorkers(projectId, serviceId, options)` - Find best workers for service deployment
    - [ ] Options: `placementStrategy` (binpack/spread/random), `minInstances`, `maxInstances`
  - [ ] `evaluateWorkerResources(workerId)` - Evaluate worker's available resources:
    - [ ] Get current resource usage (CPU/RAM/disk in use)
    - [ ] Get total resources (CPU/RAM/disk total)
    - [ ] Calculate available resources (total - current usage)
    - [ ] Factor in existing service deployments on worker
  - [ ] `checkDevicePinning(projectId, serviceId)` - Check if service is pinned to specific device
  - [ ] `calculateLoadDistribution(projectId, serviceId)` - Calculate optimal load distribution
  - [ ] `shouldScaleHorizontally(projectId, serviceId)` - Determine if horizontal scaling needed:
    - [ ] Check current instance count vs min/max from scaling policy
    - [ ] Check current metrics vs target thresholds
  - [ ] `getAvailableResources(workerId)` - Get current resource availability (considering existing deployments)
  - [ ] `getCurrentServiceLoad(workerId, projectId)` - Get current service load on worker:
    - [ ] Count of services running on worker
    - [ ] Resource usage by existing services
    - [ ] Network load (if tracked)

### 11.2 Auto-Assignment Algorithm (AWS/GCP-style bin-packing)
- [x] Implement worker selection algorithm with bin-packing:
  - [ ] Filter workers by project assignment (ProjectWorker join table)
  - [ ] Filter workers by device-specific pinning (if exists)
  - [ ] **Resource Evaluation** (like AWS ECS/GCP GKE):
    - [ ] Calculate **current resource usage** per worker (CPU/RAM/disk in use)
    - [ ] Calculate **available resources** per worker (total - current usage)
    - [ ] Factor in **existing service deployments** on each worker
    - [ ] Consider **resource requests/limits** for the service being deployed
  - [ ] **Placement Strategies** (configurable):
    - [ ] **Binpack**: Place on worker with least available resources (maximize utilization)
    - [ ] **Spread**: Distribute evenly across workers (maximize availability)
    - [ ] **Random**: Place randomly (for testing)
  - [ ] **Ranking Algorithm**:
    - [ ] Calculate suitability score based on available resources
    - [ ] Penalize workers with high current load
    - [ ] Prefer workers with sufficient headroom
    - [ ] Consider network proximity (future: same rack/datacenter)
  - [ ] Select optimal worker(s) for deployment
  - [ ] Handle horizontal scaling (select multiple workers if needed)

### 11.3 Device-Specific Pinning
- [x] Add pinning support to ServiceDeployment:
  - [ ] Add `pinned_worker_id` field (nullable) to ServiceDeployment model
  - [ ] Update ServiceDeployment repository to handle pinning
  - [ ] Add API endpoint: `POST /api/projects/:projectId/services/:serviceId/pin/:workerId`
  - [ ] Add API endpoint: `DELETE /api/projects/:projectId/services/:serviceId/pin`
  - [ ] Update ServiceOrchestrator to respect pinning (pinned services only deploy to pinned worker)

### 11.4 Project Service Management
- [x] Update ProjectService join table to include configuration:
  - [x] Add `enabled` field (0/1) - Can enable/disable service per project
  - [x] Add `config` field (JSON) - Project-specific service configuration (stored in ProjectService join table)
  - [x] Add `scaling_policy` field (JSON) - Auto-scaling configuration:
    - [ ] `min_instances`: Minimum number of instances (default: 1)
    - [ ] `max_instances`: Maximum number of instances (default: 10)
    - [ ] `target_cpu`: Target CPU utilization % (default: 70)
    - [ ] `target_memory`: Target memory utilization % (default: 80)
    - [ ] `target_request_rate`: Target requests/second per instance (optional)
    - [ ] `scale_up_cooldown`: Seconds to wait before scaling up (default: 60)
    - [ ] `scale_down_cooldown`: Seconds to wait before scaling down (default: 300)
  - [ ] Update ProjectRepository to handle service enable/disable
  - [ ] Add API endpoints:
    - [ ] `POST /api/projects/:projectId/services/:serviceId/enable` - Enable service for project (triggers auto-assignment)
    - [ ] `POST /api/projects/:projectId/services/:serviceId/disable` - Disable service for project (stops all deployments)
    - [ ] `PUT /api/projects/:projectId/services/:serviceId/config` - Update service config for project
    - [ ] `PUT /api/projects/:projectId/services/:serviceId/scaling` - Update scaling policy for project

### 11.5 Auto-Deployment Trigger
- [x] Update ServiceManager to trigger auto-assignment:
  - [x] **On Service Enable**: When service is enabled for project, automatically deploy to best worker(s) based on resources (using ServiceOrchestrator)
  - [ ] **On Resource Change**: When worker resources change significantly (>20% CPU/RAM), re-evaluate assignments
  - [ ] **On Service Disable**: When service is disabled for project, stop all deployments gracefully
  - [x] **On Project Delete**: Cleanup all deployments (already implemented in Phase 9)
  - [ ] **On Scaling Trigger**: When metrics exceed thresholds, trigger auto-scaling (scale up/down)
  - [ ] **Periodic Rebalancing**: Optional periodic rebalancing to optimize resource utilization

### 11.6 Load Balancing Configuration (Conductor as Load Balancer)
- [x] Create LoadBalancer service (`api/services/LoadBalancer.js`):
  - [x] `configureLoadBalancer(projectId, serviceId)` - Configure load balancer for service
  - [x] `getServiceInstances(projectId, serviceId)` - Get all healthy service instances
  - [x] `selectInstance(projectId, serviceId)` - Select instance using load balancing algorithm:
    - [x] **Round-robin**: Distribute requests evenly across instances
    - [x] **Least-connections**: Route to instance with fewest active connections
    - [x] **Weighted**: Route based on instance capacity/health
    - [x] **IP-hash**: Consistent hashing for session affinity (optional)
  - [x] `updateInstanceHealth(instanceId, healthy)` - Update instance health status
  - [x] `removeInstance(instanceId)` - Remove instance from load balancer
  - [x] **Service Proxy**: Conductor proxies requests to selected instance (integrated into ServiceManager.proxyServiceRequest)
  - [x] **Health Checks**: Track instance health based on request success/failure
  - [x] **Auto-configuration**: Load balancer auto-configured when service is enabled for project

### 11.7 Service Health Monitoring
- [x] Update service health checks to report to conductor:
  - [x] Conductor tracks service instance health in LoadBalancer (based on request success/failure)
  - [x] Health check endpoints: `/health` (liveness), `/ready` (readiness) - proxied through ServiceManager
  - [x] Unhealthy instances are excluded from load balancing (tracked via consecutive failures)
  - [ ] Workers report service health status to conductor (via WebSocket or HTTP) - TODO: Add worker-side health reporting
  - [ ] Auto-recovery: Restart unhealthy services after configurable retry count - TODO: Implement auto-restart logic
  - [x] Health check intervals: Configurable per service (default: 30s) - configurable via LoadBalancer.configureLoadBalancer

### 11.8 Resource-Based Scaling
- [ ] Implement resource monitoring for scaling decisions (AWS/GCP-style):
  - [ ] **Predefined Metrics**:
    - [ ] CPU utilization per service instance (target: configurable, default 70%)
    - [ ] Memory utilization per service instance (target: configurable, default 80%)
    - [ ] Request rate per service instance (requests/second)
  - [ ] **Custom Metrics Support**:
    - [ ] Allow services to publish custom metrics (queue depth, processing time, etc.)
    - [ ] Store custom metrics in conductor database or metrics service
    - [ ] Use custom metrics for scaling decisions
  - [ ] **Scaling Policies** (configurable per service-project):
    - [ ] Target tracking: Maintain target metric value (e.g., 70% CPU)
    - [ ] Step scaling: Scale by fixed increments based on metric thresholds
    - [ ] Min/max instance counts per service-project
    - [ ] Cooldown periods (scale up/down delays)
  - [ ] **Auto-scaling Actions**:
    - [ ] Auto-scale up: Deploy additional instances when metrics exceed thresholds
    - [ ] Auto-scale down: Remove instances when metrics below thresholds
    - [ ] Predictive scaling: Use historical patterns (future enhancement)

### 11.9 Service Discovery & Proxy Routes (Conductor as Load Balancer)
- [x] Implement service discovery mechanism:
  - [x] **Service Names**: Services use simple names (e.g., `storage_manager`, `key_manager`)
  - [x] **Internal Routing**: Conductor routes service requests to correct instances (via ServiceManager.proxyServiceRequest)
  - [x] **Project Isolation**: Service names are scoped to current project context (projectId required)
  - [x] **Load Balancing**: Conductor selects healthy instance using load balancing algorithm (integrated into proxyServiceRequest)
  - [x] **Service Proxy**: Conductor acts as proxy/router for service-to-service communication
  - [x] **Client IP Tracking**: Extracts client IP from request for IP-hash load balancing
  - [ ] **Future Enhancement**: DNS-based discovery (like `<service-name>.<project>.internal`)
- [ ] Add service proxy routes (`api/routes/serviceProxy.js`):
  - [ ] `POST /api/services/:serviceName/*` - Proxy requests to service instances (load balanced)
  - [ ] `GET /api/services/:serviceName/*` - Proxy GET requests to service instances
  - [ ] `PUT /api/services/:serviceName/*` - Proxy PUT requests to service instances
  - [ ] `DELETE /api/services/:serviceName/*` - Proxy DELETE requests to service instances
  - [ ] Route uses current project context to select instances
  - [ ] Load balancer selects healthy instance using configured algorithm
  - [ ] Handle service discovery: Service names are simple (e.g., `storage_manager`), conductor routes to correct instance

### 11.10 API Routes
- [x] Add service orchestration routes (`api/routes/serviceOrchestration.js`):
  - [x] `POST /api/projects/:projectId/services/:serviceId/pin/:workerId` - Pin service to specific worker
  - [x] `DELETE /api/projects/:projectId/services/:serviceId/pin` - Unpin service
  - [x] `POST /api/projects/:projectId/services/:serviceId/deploy` - Trigger manual deployment with auto-assignment
  - [x] `GET /api/projects/:projectId/services/:serviceId/assignments` - Get current service assignments
  - [x] `GET /api/projects/:projectId/services/:serviceId/scaling` - Check scaling needs
  - [x] `GET /api/workers/:workerId/resources` - Get worker resources
  - [x] `POST /api/projects/:projectId/services/:serviceId/load-balancer/configure` - Configure load balancer
  - [x] `GET /api/projects/:projectId/services/:serviceId/load-balancer/statistics` - Get LB stats
- [x] Project service management routes (`api/routes/project.js`):
  - [x] `POST /api/projects/:id/services/:serviceId/enable` - Enable service for project (triggers auto-deployment)
  - [x] `POST /api/projects/:id/services/:serviceId/disable` - Disable service for project
  - [x] `PUT /api/projects/:id/services/:serviceId/config` - Update service configuration
  - [x] `PUT /api/projects/:id/services/:serviceId/scaling` - Update scaling policy
- [ ] Additional routes (future):
  - [ ] `POST /api/projects/:projectId/services/:serviceId/rebalance` - Trigger rebalancing of service instances
  - [ ] `GET /api/projects/:projectId/services/:serviceId/instances` - Get all service instances with health status
  - [ ] `GET /api/projects/:projectId/services/:serviceId/metrics` - Get service metrics (CPU, memory, request rate)
  - [ ] `POST /api/projects/:projectId/services/:serviceId/scale-up` - Manually trigger scale up
  - [ ] `POST /api/projects/:projectId/services/:serviceId/scale-down` - Manually trigger scale down

### 11.11 Frontend Service Management
- [x] **Project Service Management UI**:
  - [x] Update ProjectDetails screen to show assigned services:
    - [x] List of services assigned to project
    - [x] Enable/disable toggle per service (with loading state and success/error messages)
    - [x] Service configuration button (opens ServiceConfigModal)
    - [x] Scaling policy configuration button (opens ScalingPolicyModal)
  - [x] Create ServiceConfigModal component:
    - [x] Form for project-specific service configuration (JSON editor)
    - [x] Save/cancel buttons
    - [x] JSON validation
  - [x] Create ScalingPolicyModal component:
    - [x] Min/max instances inputs
    - [x] Target CPU/Memory/Request rate inputs
    - [x] Cooldown period inputs
    - [x] Save/cancel buttons
    - [x] Input validation

- [ ] **Service Instance Monitoring UI**:
  - [ ] Create ServiceInstances component:
    - [ ] List all instances for a service-project
    - [ ] Show instance health status (healthy/unhealthy)
    - [ ] Show instance metrics (CPU, memory, request rate)
    - [ ] Show which worker/device each instance is on
    - [ ] Manual scale up/down buttons
    - [ ] Rebalance button
  - [ ] Add service instances to ProjectDetails screen
  - [ ] Add real-time updates via WebSocket for instance health/metrics

- [ ] **Device-Specific Pinning UI**:
  - [ ] Add "Pin to Device" option in ServiceInstances component
  - [ ] Create DevicePinModal:
    - [ ] Dropdown to select worker/device
    - [ ] Confirm pinning action
  - [ ] Show pinned status in ServiceInstances list
  - [ ] Add "Unpin" button for pinned services

- [ ] **Auto-Scaling Visualization**:
  - [ ] Create MetricsChart component:
    - [ ] Display CPU/Memory/Request rate over time
    - [ ] Show scaling events (scale up/down markers)
    - [ ] Show target thresholds
  - [ ] Add metrics chart to ServiceInstances view
  - [ ] Show current vs target metrics

- [ ] **Load Balancing Visualization**:
  - [ ] Show request distribution across instances
  - [ ] Display load balancing algorithm being used
  - [ ] Show instance weights (if using weighted algorithm)
  - [ ] Visual indicator of which instance handled last request

- [ ] **Service Assignment Visualization**:
  - [ ] Create ServiceAssignmentView component:
    - [ ] Show which workers have which services
    - [ ] Visual representation of resource utilization per worker
    - [ ] Show why each service was assigned to each worker (resource availability, pinning, etc.)
  - [ ] Add to ProjectDetails screen

- [ ] **Service Enable/Disable Flow**:
  - [ ] Update ProjectDetails to show "Enable Service" button when service not enabled
  - [ ] Show loading state during auto-assignment
  - [ ] Show success message with assigned worker(s)
  - [ ] Show error message if assignment fails

- [ ] **Dashboard Updates**:
  - [ ] Add service overview cards to Dashboard (when project selected):
    - [ ] Total services enabled
    - [ ] Total service instances running
    - [ ] Services needing attention (unhealthy instances, scaling events)
  - [ ] Add service metrics summary

- [ ] **Service List Screen**:
  - [ ] Create Services screen (`screens/Services/Services.jsx`):
    - [ ] List all available services
    - [ ] Show which projects have each service enabled
    - [ ] Filter by project
    - [ ] Navigate to service details per project

- [ ] **Service Details Screen**:
  - [ ] Create ServiceDetails screen (`screens/ServiceDetails/ServiceDetails.jsx`):
    - [ ] Show service information
    - [ ] Show all projects using this service
    - [ ] Show all instances across all projects
    - [ ] Metrics and health status
    - [ ] Scaling history

### 11.12 Testing
- [ ] Unit tests for ServiceOrchestrator:
  - [ ] Test worker selection algorithm
  - [ ] Test resource evaluation
  - [ ] Test device pinning logic
  - [ ] Test load distribution calculation
  - [ ] Test horizontal scaling decisions
- [ ] Integration tests:
  - [ ] Test auto-assignment on service enable
  - [ ] Test device-specific pinning
  - [ ] Test load balancing configuration
  - [ ] Test horizontal scaling
  - [ ] Test resource-based scaling decisions
- [ ] Frontend component tests:
  - [ ] Test ServiceInstances component
  - [ ] Test ServiceConfigModal component
  - [ ] Test ScalingPolicyModal component
  - [ ] Test DevicePinModal component
  - [ ] Test MetricsChart component
  - [ ] Test ServiceAssignmentView component
- [ ] End-to-end tests:
  - [ ] Test full flow: Enable service → Auto-assignment → Deploy → Monitor → Scale
  - [ ] Test device pinning flow
  - [ ] Test scaling policy updates
  - [ ] Test load balancing across instances

### 11.13 Documentation
- [ ] Update README with service orchestration architecture
- [ ] Document auto-assignment algorithm
- [ ] Document device-specific pinning
- [ ] Document load balancing configuration
- [ ] Document scaling policies
- [ ] Document frontend UI/UX for service management

## Next Steps

After completing this plan:
- **Frontend**: Implement React Native frontend (Phase 7) - See [frontend_guidelines.md](../frontend_guidelines.md)
- **Worker Setup**: Move to [../worker/plan.md](../worker/plan.md) for Worker Setup
- **Projects Feature**: Complete Phase 9 above, then move to [../worker/plan.md](../worker/plan.md) Phase 10
- **Services**: Implement individual services from [../plan.md](../plan.md) Chapter 3
