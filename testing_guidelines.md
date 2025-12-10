# Testing Guidelines

## Testing Philosophy

- **Test behavior, not implementation**
- **Write tests that give confidence**
- **Keep tests fast and maintainable**
- **Test critical paths first**

## Test Structure

### Unit Tests

Test individual functions, services, and repositories in isolation.

**Location**: `__tests__/` or `.test.js` files next to source files

**Example**:
```javascript
// services/__tests__/UserService.test.js
const UserService = require('../UserService');
const UserRepository = require('../../repos/UserRepository');

describe('UserService', () => {
  let userService;
  let mockUserRepository;

  beforeEach(() => {
    mockUserRepository = {
      findByUsername: jest.fn(),
      create: jest.fn(),
    };
    userService = new UserService(mockUserRepository);
  });

  describe('authenticate', () => {
    it('should return token for valid credentials', async () => {
      // Test implementation
    });

    it('should throw error for invalid credentials', async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

Test service interactions and API endpoints.

**Location**: `__tests__/integration/` or `tests/integration/`

**Example**:
```javascript
// tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../conductor/index');

describe('POST /api/auth/login', () => {
  it('should return JWT token for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'password' });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### End-to-End Tests

Test complete workflows from user perspective.

**Location**: `tests/e2e/`

## Testing Standards

### Backend Testing

#### Services
- Test business logic
- Mock dependencies (repositories, other services)
- Test error cases
- Test edge cases
- Test validation logic

#### Repositories
- Test database operations
- Use test database (in-memory SQLite for SQLite)
- Clean up after tests
- Test CRUD operations

#### Routes/Controllers
- Test HTTP endpoints
- Test request validation
- Test response format
- Test error handling
- Test authentication/authorization

### Frontend Testing

#### Components
- Test rendering
- Test user interactions
- Test props handling
- Test conditional rendering
- Use React Testing Library

**Example**:
```javascript
// components/__tests__/Button.test.jsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click me" onPress={onPress} />
    );
    
    fireEvent.press(getByText('Click me'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

#### Hooks
- Test hook behavior
- Test state changes
- Test side effects
- Use `@testing-library/react-hooks`

#### Services/API
- Mock API calls
- Test error handling
- Test data transformation

## Test Organization

Mirror source structure in test folders:

```
conductor/
├── services/
│   ├── UserService.js
│   └── __tests__/
│       └── UserService.test.js
├── repos/
│   ├── UserRepository.js
│   └── __tests__/
│       └── UserRepository.test.js
└── routes/
    ├── auth.js
    └── __tests__/
        └── auth.test.js
```

## Test Coverage

- Aim for **80%+ coverage** for critical paths
- Focus on business logic and error handling
- Don't obsess over 100% coverage
- Use coverage reports to find gaps

## Test Data

- Use factories/fixtures for test data
- Keep test data minimal and focused
- Use realistic but simple data
- Clean up test data after tests

**Example**:
```javascript
// tests/fixtures/users.js
export const createTestUser = (overrides = {}) => ({
  username: 'testuser',
  password: 'password123',
  email: 'test@example.com',
  ...overrides,
});
```

## Mocking

### When to Mock

- External APIs
- Database operations (in unit tests)
- File system operations
- Time-dependent functions
- Random functions

### Mocking Best Practices

- Mock at the boundary (external dependencies)
- Don't mock what you're testing
- Use realistic mock data
- Reset mocks between tests

## Test Naming

Use descriptive test names:

```javascript
// Good
it('should return error when user does not exist', () => {});
it('should encrypt password before storing', () => {});

// Bad
it('works', () => {});
it('test 1', () => {});
```

## Test Structure (AAA Pattern)

Arrange, Act, Assert:

```javascript
it('should authenticate user with valid credentials', async () => {
  // Arrange
  const username = 'testuser';
  const password = 'password123';
  mockUserRepository.findByUsername.mockResolvedValue({
    username,
    passwordHash: hashedPassword,
  });

  // Act
  const result = await userService.authenticate(username, password);

  // Assert
  expect(result).toHaveProperty('token');
  expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(username);
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- UserService.test.js

# Run tests matching pattern
npm test -- --testNamePattern="authenticate"
```

## Continuous Integration

- Run tests on every commit
- Fail builds on test failures
- Generate coverage reports
- Run tests in CI/CD pipeline

## Test Maintenance

- Keep tests up to date with code changes
- Remove obsolete tests
- Refactor tests when code refactors
- Review test failures promptly
- Keep tests fast (< 1 second per test file)

## Integration Test Requirements

For each service:
- Test service API endpoints
- Test service-to-conductor communication
- Test inter-service communication (if applicable)
- Test error handling
- Test authentication/authorization

## Performance Testing

- Test API response times
- Test database query performance
- Test concurrent requests
- Load testing for critical endpoints
