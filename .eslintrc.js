const semver = require('semver');

// Converts semver range `~16.6.0` to strict version `16.6.0`
const reactVersion = semver.coerce(
  require('./package.json').dependencies.react,
).version;

const isDevelopment = process.env.NODE_ENV === 'development';

const rules = {
  'comma-dangle': [2, 'always-multiline'],
  'comma-spacing': [2, { before: false, after: true }],
  eqeqeq: [2, 'smart'],
  'guard-for-in': 2,
  'key-spacing': [2, { beforeColon: false, afterColon: true }],
  'keyword-spacing': [2, { before: true, after: true }],
  'new-cap': [
    2,
    { newIsCapExceptions: ['acl.memoryBackend', 'acl', 'useQueryClient'] },
  ],
  'no-caller': 2,
  'no-console': isDevelopment ? 1 : 2,
  'no-duplicate-imports': 2,
  'no-multi-spaces': 2,
  'no-process-exit': 2,
  'no-spaced-func': 2,
  'no-throw-literal': 2,
  'no-trailing-spaces': 2,
  'no-unneeded-ternary': 2,
  'no-unused-expressions': 0,
  'no-use-before-define': [1, 'nofunc'],
  'object-curly-spacing': [2, 'always'],
  'object-shorthand': 2,
  'one-var': [2, 'never'],
  'one-var-declaration-per-line': [2, 'always'],
  semi: [2, 'always'],
  'spaced-comment': [2, 'always'],
  strict: [2, 'never'],
  'quote-props': 0,
  'no-var': 2,
  'prefer-const': 2,
  'arrow-spacing': [2, { before: true, after: true }],
  'require-atomic-updates': 0,
  'import/first': 2,
  'prettier/prettier': 2,
};

module.exports = {
  // Keep linting scoped to this worktree (parent repo .eslintrc must not load).
  root: true,
  extends: ['eslint:recommended', 'plugin:import/errors', 'prettier'],
  rules,
  plugins: ['react', 'import', 'prettier'],
  settings: {
    'import/resolver': {
      webpack: {
        config: __dirname + '/config/webpack/webpack.config.js',
      },
    },
  },
  env: {
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  parser: '@babel/eslint-parser',
  overrides: [
    /**
     * Overrides for server side app files
     */
    {
      files: [
        '*.js',
        'config/**',
        'migrations/**',
        'modules/*/shared/**/*.js',
        'modules/*/server/*.js',
        'modules/*/server/**/*.js',
        'testutils/server/**',
      ],
      env: {
        node: true,
      },
    },

    /**
     * Overrides for client-React code
     */
    {
      files: [
        'config/client/**',
        'modules/admin/client/**',
        'modules/**/client/components/**',
        'modules/**/client/react-app/**',
        'modules/**/client/api/**',
        'modules/**/client/utils/**',
        'modules/**/client/services/**',
        'modules/experiences/tests/client/**',
      ],
      env: {
        browser: true,
      },
      extends: ['plugin:react/recommended', 'prettier'],
      settings: {
        react: {
          version: reactVersion,
        },
      },
      parser: '@babel/eslint-parser',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2018,

        sourceType: 'module',
      },
      rules: {
        'react/no-access-state-in-setstate': 2,
        'no-multi-assign': 2,
      },
    },

    /**
     * Overrides for client side test files
     */
    {
      files: [
        'modules/*/tests/client/*.js',
        'modules/*/tests/client/**/*.js',
        'testutils/client/*.js',
      ],
      extends: [
        'plugin:react/recommended',
        'plugin:testing-library/react',
        'plugin:jest-dom/recommended',
        'prettier',
      ],
      settings: {
        react: {
          version: reactVersion,
        },
      },
      env: {
        browser: true,
        jest: true,
        jasmine: true,
        jquery: true,
      },
      globals: {
        L: true,
      },
    },

    /**
     * Overrides for server side test files
     */
    {
      files: [
        'modules/*/tests/server/*.js',
        'modules/*/tests/server/**/*.js',
        'testutils/server/*.js',
      ],
      env: {
        node: true,
        mocha: true,
      },
    },

    /**
     * Overrides for CLI scripts and application config
     */
    {
      files: ['bin/**', 'config/**', 'migrations/**'],
      env: {
        node: true,
      },
      rules: {
        'no-console': 0,
        'no-process-exit': 0,
      },
    },
  ],
};
