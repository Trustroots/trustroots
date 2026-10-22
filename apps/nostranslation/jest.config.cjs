const base = require('../../jest.config.cjs');

module.exports = {
  ...base,
  rootDir: '../..',
  roots: ['<rootDir>/apps/nostranslation'],
  testMatch: ['<rootDir>/apps/nostranslation/tests/**/*.tests.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/apps/nostranslation/tests/setup.ts'],
  globals: { __NOSTRANSLATION_API_URL__: 'https://translation-api.example' },
  collectCoverageFrom: [
    '<rootDir>/apps/nostranslation/shared.ts',
    '<rootDir>/apps/nostranslation/client/**/*.{ts,tsx}',
    '<rootDir>/apps/nostranslation/server/**/*.mts',
    '!**/*.d.ts',
    '!**/main.tsx',
    '!**/start.mts',
    '!**/worker.mts',
    '!**/check.mts',
  ],
  coverageDirectory: '<rootDir>/coverage/nostranslation',
  coverageThreshold: {
    global: { statements: 100, branches: 100, functions: 100, lines: 100 },
  },
};
