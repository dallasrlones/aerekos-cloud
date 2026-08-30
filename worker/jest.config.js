module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'api/**/*.js',
    'docker/**/*.js',
    'services/**/*.js',
    'shared/**/*.js',
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

