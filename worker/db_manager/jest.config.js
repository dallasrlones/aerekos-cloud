/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1,
  setupFiles: ['<rootDir>/tests/setup.js'],
  // “Docker farm” / full-stack tests hit live conductor; run with npm run test:integration
  testPathIgnorePatterns:
    process.env.DB_MANAGER_INTEGRATION === '1'
      ? []
      : ['<rootDir>/tests/integration/databases/']
};
