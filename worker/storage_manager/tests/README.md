# Storage Manager Tests

Comprehensive test suite for the Storage Manager service.

## Test Structure

```
tests/
├── helpers/
│   ├── testHelpers.js    # Test utilities and fixtures
│   └── setup.js          # Test environment setup/teardown
├── unit/
│   └── services/         # Unit tests for services
│       ├── ProjectService.test.js
│       ├── BucketService.test.js
│       ├── StorageService.test.js
│       ├── EncryptionService.test.js
│       ├── ChunkedUploadService.test.js
│       └── SignedUrlService.test.js
├── integration/
│   └── api.test.js       # API endpoint integration tests
└── e2e/
    └── storageFlow.test.js  # End-to-end workflow tests
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- ProjectService.test.js
```

### Run tests matching pattern
```bash
npm test -- --testNamePattern="upload"
```

## Test Coverage

The test suite covers:

- **Unit Tests**: All service methods with mocked dependencies
- **Integration Tests**: API endpoints with real database
- **End-to-End Tests**: Complete workflows from start to finish

## Test Environment

Tests use:
- **Test Database**: SQLite database at `./data/test_storage_manager.db`
- **Test Storage**: Directory at `./storage/test`
- **Mocked Services**: key_manager calls are mocked by default
- **Isolated Environment**: Each test run cleans up before/after

## Writing New Tests

### Unit Test Example
```javascript
describe('MyService', () => {
  let myService;
  let mockRepository;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn()
    };
    myService = new MyService(mockRepository);
  });

  it('should do something', async () => {
    mockRepository.findById.mockResolvedValue({ id: '1' });
    
    const result = await myService.doSomething('1');
    
    expect(result).toBeDefined();
    expect(mockRepository.findById).toHaveBeenCalledWith('1');
  });
});
```

### Integration Test Example
```javascript
const request = require('supertest');
const app = require('../../index');

describe('API Endpoint', () => {
  const authHeader = { Authorization: 'Bearer test-token' };

  it('should create resource', async () => {
    const response = await request(app)
      .post('/api/resource')
      .set(authHeader)
      .send({ name: 'test' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});
```

## Test Helpers

### Available Helpers

- `createTestProject()` - Create test project data
- `createTestBucket()` - Create test bucket data
- `createTestFile()` - Create test file data
- `createTestFileBuffer()` - Create test file buffer
- `mockConductorRegistration()` - Mock conductor registration
- `mockKeyManagerResponse()` - Mock key_manager response
- `cleanupTestDb()` - Clean up test database
- `cleanupTestStorage()` - Clean up test storage

## Test Cases

See `plan.md` Phase 6 for complete list of all test cases.

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- Fast execution (< 30 seconds for full suite)
- No external dependencies required
- Isolated test environment
- Automatic cleanup
