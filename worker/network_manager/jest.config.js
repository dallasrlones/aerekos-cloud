module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1,
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['api/**/*.js', 'index.js', '!**/node_modules/**'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 15000
};
