module.exports = {
  moduleNameMapper: {
    // '\\.html$': '<rootDir>/jest.mocks.html.js',
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
  }
};

