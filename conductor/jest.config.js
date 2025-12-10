module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/services/aerekos-record/**',
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
