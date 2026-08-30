module.exports = {
  testEnvironment: 'node',
  // integration/websocket + socket.io can leave async handles; avoid hanging the runner
  forceExit: true,
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'api/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  maxWorkers: 1 // Run tests serially to avoid database lock issues
};
