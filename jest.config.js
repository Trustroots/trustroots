module.exports = {
  watchman: false,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^modules/(.*)$': '<rootDir>/modules/$1',
    '^.+\\.(css|jpg|png|gif|webp|svg|less)$':
      '<rootDir>/jest/jest.empty-module.js',
  },
  testMatch: ['<rootDir>/modules/*/tests/client/**/*.tests.js'],
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    '<rootDir>/modules/*/client/**/*.js',
    '!<rootDir>/modules/*/tests/**',
    '!<rootDir>/modules/*/client/**/*.module.js',
    '!<rootDir>/modules/*/client/**/views/**',
    '!<rootDir>/modules/*/client/**/less/**',
  ],
  coverageDirectory: '<rootDir>/coverage/client',
  coverageReporters: ['text-summary', 'html', 'json-summary', 'lcov'],
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
