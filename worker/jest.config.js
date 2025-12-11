module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'api/**/*.js',
    'docker/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'index.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 15000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};

