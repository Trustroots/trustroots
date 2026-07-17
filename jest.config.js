module.exports = {
  watchman: false,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^modules/(.*)$': '<rootDir>/modules/$1',
    '^nostr-tools/relay$':
      '<rootDir>/node_modules/nostr-tools/lib/cjs/relay.js',
    '^nostr-tools/nip19$':
      '<rootDir>/node_modules/nostr-tools/lib/cjs/nip19.js',
    '^.+\\.(css|jpg|png|gif|webp|svg|less|html)$':
      '<rootDir>/jest/jest.empty-module.js',
  },
  testMatch: ['<rootDir>/modules/*/tests/client/**/*.tests.js'],
  testEnvironment: 'jsdom',
  testRunner: 'jest-jasmine2',
  collectCoverageFrom: [
    '<rootDir>/modules/*/client/**/*.js',
    '!<rootDir>/modules/*/tests/**',
    '!<rootDir>/modules/*/client/**/views/**',
    '!<rootDir>/modules/*/client/**/less/**',
  ],
  coverageDirectory: '<rootDir>/coverage/client',
  coverageReporters: ['text-summary', 'html', 'json-summary', 'lcov'],
  setupFilesAfterEnv: ['<rootDir>/jest/jest.setup.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/'],
};
