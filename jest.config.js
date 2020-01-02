module.exports = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^modules/(.*)$': '<rootDir>/modules/$1'
  },
  testMatch: [
    '<rootDir>/modules/*/tests/client/**/*.tests.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  transform: {
    '^.+\\.js$': 'babel-jest',
    '^.+\\.html$': '<rootDir>/jest.transform.html.js'
  },
  transformIgnorePatterns: [
    // we want to ignore everything in node_modules
    // except the html templates inside angular-ui-bootstrap
    '/node_modules/(?!angular-ui-bootstrap.+\\.html)'
  ]
};

