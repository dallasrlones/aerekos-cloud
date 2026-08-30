# Key Manager Service - Test Suite

## Overview

Comprehensive test suite for the Key Manager Service covering unit tests, integration tests, and end-to-end scenarios.

## Test Structure

```
tests/
├── setup.js                    # Test configuration and setup
├── unit/                       # Unit tests (isolated components)
│   ├── KeyService.test.js      # KeyService business logic tests
│   ├── KeyRepository.test.js   # Repository data access tests
│   ├── encryption.test.js      # Encryption utility tests
│   ├── auth.test.js            # Authentication middleware tests
│   └── portDetection.test.js  # Port detection utility tests
├── integration/                # Integration tests (API + services)
│   ├── api.test.js             # API endpoint tests
│   ├── serviceRegistration.test.js  # Service registration tests
│   └── keyLifecycle.test.js    # Full key lifecycle tests
└── helpers/                    # Test utilities
    └── testHelpers.js          # Shared test helpers
```

## Test Coverage

### Unit Tests (5 files)

1. **KeyService.test.js** - Tests core key management logic:
   - Key creation (symmetric, asymmetric)
   - Key retrieval (by name, by version)
   - Key listing and filtering
   - Key rotation
   - Key deletion and archiving
   - Encryption/decryption

2. **KeyRepository.test.js** - Tests data access layer:
   - CRUD operations
   - Query methods
   - Access logging

3. **encryption.test.js** - Tests encryption utilities:
   - Master key encryption/decryption
   - Key material generation
   - Key derivation
   - Key hashing

4. **auth.test.js** - Tests authentication middleware:
   - Token validation
   - Error handling
   - Dev mode fallbacks

5. **portDetection.test.js** - Tests port detection:
   - Available port detection
   - Port conflict handling

### Integration Tests (3 files)

1. **api.test.js** - Tests all API endpoints:
   - POST /api/keys (create)
   - GET /api/keys (list)
   - GET /api/keys/:name (get)
   - POST /api/keys/:name/rotate (rotate)
   - DELETE /api/keys/:name (delete)
   - POST /api/keys/:name/archive (archive)
   - Error cases and validation

2. **serviceRegistration.test.js** - Tests service registration:
   - Successful registration
   - Error handling
   - Dev mode fallbacks

3. **keyLifecycle.test.js** - Tests complete key lifecycle:
   - Create → Get → Rotate → Archive → Delete
   - Version management
   - Multi-version scenarios

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- KeyService.test.js

# Run unit tests only
npm test -- tests/unit

# Run integration tests only
npm test -- tests/integration
```

## Test Environment

Tests use:
- In-memory SQLite database (`:memory:`)
- Mocked external dependencies (axios, conductor)
- Test master key (hardcoded for consistency)
- Isolated test environment (NODE_ENV=test)

## Test Data

- **Master Key**: `a1b2c3d4e5f67890123456789012345678901234567890123456789012345678` (64 hex chars = 32 bytes for AES-256)
- **Test Keys**: Created dynamically in each test
- **Mock Services**: Conductor, authentication endpoints

## Coverage Goals

- **Unit Tests**: >90% code coverage
- **Integration Tests**: All API endpoints covered
- **Critical Paths**: 100% coverage

## Writing New Tests

When adding new tests:

1. **Unit Tests**: Test individual functions/methods in isolation
2. **Integration Tests**: Test API endpoints with mocked dependencies
3. **Follow Naming**: Use descriptive test names (`should do X when Y`)
4. **Isolation**: Each test should be independent
5. **Cleanup**: Clean up test data after each test

## Mocking Guidelines

- Mock external services (conductor, axios)
- Mock database repositories for unit tests
- Use real database for integration tests (in-memory SQLite)
- Mock authentication middleware for API tests

## Test Helpers

Use `tests/helpers/testHelpers.js` for:
- Generating test master keys
- Mocking conductor responses
- Common test utilities

## Continuous Integration

Tests should pass:
- ✅ All unit tests
- ✅ All integration tests
- ✅ Code coverage >90%
- ✅ No linter errors
- ✅ No memory leaks
