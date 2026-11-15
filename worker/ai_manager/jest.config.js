module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1,
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 15000,
  // worker/shared/* requires axios; resolve from this package's node_modules
  moduleNameMapper: {
    '^axios$': '<rootDir>/node_modules/axios',
  },
};
