module.exports = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^modules/(.*)$': '<rootDir>/modules/$1',
    // doesn't play nicely with jest, see jest.setup.js for more info
    'angular-waypoints/dist/angular-waypoints.all': '<rootDir>/jest/jest.empty-module.js',
  },
  testMatch: [
    '<rootDir>/modules/*/tests/client/**/*.tests.js',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/jest/jest.setup.js',
  ],
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

