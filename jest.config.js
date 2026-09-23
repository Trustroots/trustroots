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
  testMatch: ['<rootDir>/modules/*/tests/client/**/*.tests.[jt]s?(x)'],
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    '<rootDir>/modules/*/client/**/*.{js,ts,tsx}',
    '!<rootDir>/modules/*/tests/**',
    '!<rootDir>/modules/*/client/**/*.module.{js,ts,tsx}',
    '!<rootDir>/modules/*/client/**/views/**',
    '!<rootDir>/modules/*/client/**/less/**',
  ],
  coverageDirectory: '<rootDir>/coverage/client',
  coverageReporters: ['text-summary', 'html', 'json-summary', 'lcov'],
  setupFilesAfterEnv: ['<rootDir>/jest/jest.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!use-local-storage-state/)'],
};
