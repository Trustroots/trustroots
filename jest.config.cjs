module.exports = {
  roots: ['<rootDir>/modules', '<rootDir>/layers', '<rootDir>/packages'],
  watchman: false,
  moduleNameMapper: {
    '^@/(.*)\\.js$': '<rootDir>/$1',
    '^modules/(.*)\\.js$': '<rootDir>/modules/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^modules/(.*)$': '<rootDir>/modules/$1',
    '^nostr-tools/relay$':
      '<rootDir>/node_modules/nostr-tools/lib/cjs/relay.js',
    '^nostr-tools/nip19$':
      '<rootDir>/node_modules/nostr-tools/lib/cjs/nip19.js',
    '^.+\\.(css|jpg|png|gif|webp|svg|less|html)$':
      '<rootDir>/jest/jest.empty-module.cts',
  },
  testMatch: ['<rootDir>/modules/*/tests/client/**/*.tests.[jt]s?(x)'],
  testEnvironment: '<rootDir>/jest/jest.environment.cts',
  collectCoverageFrom: [
    '<rootDir>/modules/*/client/**/*.{js,ts,tsx}',
    '<rootDir>/layers/shell/**/*.{js,ts,tsx}',
    '<rootDir>/packages/ui/**/*.{js,ts,tsx}',
    '!<rootDir>/modules/core/client/types.d.ts',
    '!<rootDir>/modules/*/tests/**',
    '!<rootDir>/modules/*/client/**/*.d.ts',
    '!<rootDir>/modules/*/client/**/*.module.{js,ts,tsx}',
    '!<rootDir>/modules/*/client/**/views/**',
    '!<rootDir>/modules/*/client/**/less/**',
  ],
  coverageDirectory: '<rootDir>/coverage/client',
  coverageReporters: ['text-summary', 'html', 'json-summary', 'lcov'],
  setupFilesAfterEnv: ['<rootDir>/jest/jest.setup.cts'],
  transform: {
    '^.+\\.[cm]?[jt]sx?$': 'babel-jest',
  },
  // Transform ESM-only client dependencies and their nested packages.
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?(use-local-storage-state|nostr-tools|supercluster|kdbush|@noble|@scure|@faker-js)/)',
  ],
};
