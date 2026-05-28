module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: [
    'lib/**/*.js',
    'index.js',
    '!lib/services/_generated/**',
  ],
  coverageThreshold: {
    global: {
      lines: 55,
      branches: 45,
    },
    './lib/config.js': { lines: 95, branches: 85 },
    './lib/oauth.js': { lines: 90, branches: 70 },
    './lib/debug.js': { lines: 80, branches: 75 },
    './lib/filters.js': { lines: 90, branches: 85 },
    './lib/pagination.js': { lines: 80, branches: 75 },
    './lib/services/_registry.js': { lines: 95, branches: 75 },
  },
  testPathIgnorePatterns: ['/node_modules/', '/test/fixtures/', '/test/helpers/'],
  verbose: false,
};
