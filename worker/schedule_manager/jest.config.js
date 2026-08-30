module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/beforeFile.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['api/**/*.js', 'index.js', '!**/node_modules/**'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 15000,
  maxWorkers: 1
};
