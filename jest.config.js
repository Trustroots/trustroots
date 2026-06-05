module.exports = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^modules/(.*)$': '<rootDir>/modules/$1',
    '^nostr-tools/relay$':
      '<rootDir>/node_modules/nostr-tools/lib/cjs/relay.js',
    '^nostr-tools/nip19$':
      '<rootDir>/node_modules/nostr-tools/lib/cjs/nip19.js',
    '^.+\\.(css|jpg|png|gif|webp|svg|less)$':
      '<rootDir>/jest/jest.empty-module.js',
  },
  testMatch: ['<rootDir>/modules/*/tests/client/**/*.tests.js'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest/jest.setup.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
    '^.+\\.html$': '<rootDir>/jest/jest.transform.html.js',
  },
  transformIgnorePatterns: [
    // we want to ignore everything in node_modules
    // except the html templates inside angular-ui-bootstrap
    '/node_modules/(?!angular-ui-bootstrap.+\\.html)',
  ],
};
