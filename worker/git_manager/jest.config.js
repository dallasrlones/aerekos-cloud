module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1,
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 15000
};
