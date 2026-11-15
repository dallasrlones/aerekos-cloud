module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1,
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 15000,
  // Jest resolves axios's ESM index.js; pin the Node CJS build for aerekos-record + mocks.
  moduleNameMapper: {
    '^axios$': '<rootDir>/node_modules/axios/dist/node/axios.cjs',
  },
};
