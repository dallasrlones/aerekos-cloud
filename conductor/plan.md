# Conductor Implementation Plan

## ✅ STATUS: IN PROGRESS

**Backend:** All phases complete! All 48 tests passing.
**Frontend:** Phase 7 in progress - Core UI components and navigation complete.

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
- [x] Set up database connection using `api/services/aerekos-record`
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
- [x] **76/76 tests passing ✅** (4 test suites, 76 tests total)
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

### 8.3 Test Scaffolding & Infrastructure
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

**Backend:** Phases 1-6 complete, Phase 8 in progress (missing tests for new endpoints)
**Frontend:** Phase 7 in progress - Core UI components and navigation complete

### Backend (Phases 1-6, 8)
- ✅ **76/76 tests passing** (4 test suites, 76 tests total)
- ✅ All API endpoints working and tested
- ✅ Database models created and tested
- ✅ Authentication system complete
- ✅ Token generation working
- ✅ Password reset endpoint (`POST /api/auth/reset-password`) implemented and tested
- ✅ Profile update endpoint (`PUT /api/auth/profile`) implemented and tested
- ✅ Health checks implemented with database connectivity
- ✅ Request ID middleware added for correlation tracking
- ✅ API versioning in place (`/api/v1/*` and `/api/*`)
- ✅ Comprehensive test scaffolding with setup/teardown
- ✅ Test helpers and utilities created
- ✅ All test isolation issues resolved
- ✅ All new endpoints fully tested (password reset and profile update)
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
- ✅ URL-based routing for web (`/`, `/settings`, `/menu`)
- ✅ Browser navigation support (back/forward buttons)
- ✅ Dockerized with multi-stage build (nginx)
- ✅ Docker Compose integration
- ✅ Environment variable configuration
- ✅ Nodemon setup for API development with auto-restart

## Next Steps

After completing this plan:
- **Frontend**: Implement React Native frontend (Phase 7) - See [frontend_guidelines.md](../frontend_guidelines.md)
- **Worker Setup**: Move to [../worker/plan.md](../worker/plan.md) for Worker Setup
- **Services**: Implement individual services from [../plan.md](../plan.md) Chapter 3
