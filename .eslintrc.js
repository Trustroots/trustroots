const semver = require('semver');

// Converts semver range `~16.6.0` to strict version `16.6.0`
const reactVersion = semver.coerce(require('./package.json').dependencies.react).version;

const defaultRules = {
  camelcase: 0,
  'comma-dangle': [2, 'never'],
  'comma-spacing': [2, { before: false, after: true }],
  'consistent-return': 0,
  curly: [2, 'multi-line'],
  'default-case': 0,
  eqeqeq: [2, 'smart'],
  'func-names': 0,
  'guard-for-in': 2,
  indent: [2, 2, { SwitchCase: 1, VariableDeclarator: { var: 2, let: 2, const: 3 } }],
  'key-spacing': [2, { beforeColon: false, afterColon: true }],
  'keyword-spacing': [2, { before: true, after: true }],
  'max-len': 0,
  'new-cap': [2, { newIsCapExceptions: ['acl.memoryBackend', 'acl'] }],
  'no-bitwise': 0,
  'no-caller': 2,
  'no-console': 2,
  'no-else-return': 0,
  'no-multi-spaces': 2,
  'no-param-reassign': 0,
  'no-process-exit': 2,
  'no-shadow': 0,
  'no-spaced-func': 2,
  'no-throw-literal': 2,
  'no-trailing-spaces': 2,
  'no-unneeded-ternary': 2,
  'no-underscore-dangle': 0,
  'no-unused-expressions': 0,
  'no-use-before-define': [1, 'nofunc'],
  'object-curly-spacing': [2, 'always'],
  'one-var': [2, 'never'],
  'one-var-declaration-per-line': [2, 'always'],
  'padded-blocks': 0,
  'semi': [2, 'always'],
  'space-before-function-paren': ['error', {
    'anonymous': 'always',
    'named': 'never',
    'asyncArrow': 'always'
  }],
  'space-in-parens': [2, 'never'],
  'spaced-comment': [2, 'always'],
  strict: 0,
  'quote-props': 0,
  quotes: [1, 'single'],
  'wrap-iife': [2, 'outside'],
  'vars-on-top': 0,
  'no-var': 2,
  'prefer-const': 2,
  'arrow-spacing': [2, { before: true, after: true }]
};

module.exports = {
  extends: 'eslint:recommended',
  rules: defaultRules,
  plugins: ['angular', 'react'],
  env: {
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2018
  },
  parser: 'babel-eslint',
  overrides: [
    /**
     * Overrides for server side app files
     */
    {
      files: [
        '*.js',
        'config/**',
        'migrations/**',
        'modules/*/server/*.js',
        'modules/*/server/**/*.js',
        'testutils/server/**',
      ],
      env: {
        node: true,
      },
    },

    /**
     * Overrides for client Angular code
     */
    {
      files: [
        'modules/*/client/*.module.js',
        'modules/*/client/config/*.js',
        'modules/*/client/controllers/*.js',
        'modules/*/client/directives/*.js',
        'modules/*/client/filters/*.js',
        'modules/*/client/services/*.js',
        'modules/core/client/app/config.js',
        'modules/core/client/app/init.js',
        'testutils/client/*.js',
      ],
      rules: {
        'angular/component-limit': 0,
        'angular/controller-as-route': 1,
        'angular/controller-as-vm': 1,
        'angular/controller-as': 1,
        'angular/deferred': 1,
        'angular/di-unused': 2,
        'angular/directive-restrict': 0,
        'angular/empty-controller': 2,
        'angular/no-controller': 0,
        'angular/no-inline-template': 0,
        'angular/no-run-logic': 0,
        'angular/no-services': 0,
        'angular/on-watch': 0,
        'angular/prefer-component': 0,
        'angular/no-cookiestore': 2,
        'angular/no-directive-replace': 0,
        'angular/no-http-callback': 2,
        'angular/angularelement': 2,
        'angular/definedundefined': 2,
        'angular/document-service': 2,
        'angular/interval-service': 2,
        'angular/json-functions': 2,
        'angular/log': 1,
        'angular/timeout-service': 2,
        'angular/typecheck-array': 2,
        'angular/typecheck-date': 2,
        'angular/typecheck-function': 2,
        'angular/typecheck-number': 2,
        'angular/typecheck-object': 2,
        'angular/typecheck-string': 2,
        'angular/window-service': 2
      },
      settings: {
        angular: 1,
      },
      env: {
        browser: true,
        jquery: true,
      },
      globals: {
        angular: true,
        AppConfig: true,
        L: true,
        moment: true,
        PruneCluster: true,
        PruneClusterForLeaflet: true,
      },
      parser: 'babel-eslint',
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module'
      },
    },

    /**
     * Overrides for client-React code
     */
    {
      files: [
        'config/client/**',
        'modules/admin/client/**',
        'modules/core/client/app/config.js',
        'modules/**/client/components/**',
        'modules/**/client/api/**',
        'modules/**/client/utils/**',
        'modules/core/client/services/photos.service.js',
        'modules/references/tests/client/**'
      ],
      env: {
        browser: true,
      },
      extends: 'plugin:react/recommended',
      settings: {
        react: {
          version: reactVersion
        }
      },
      parser: 'babel-eslint',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        ecmaVersion: 2018,
        sourceType: 'module'
      },
      rules: {
        'react/no-access-state-in-setstate': 2
      }
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
      env: {
        browser: true,
        jasmine: true,
        mocha: true,
        jquery: true
      },
      globals: {
        angular: true,
        AppConfig: true,
        inject: true,
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
        mocha: true
      }
    },

    /**
     * Overrides for CLI scripts and application config
     */
    {
      files: [
        'bin/**',
        'config/**',
        'migrations/**',
      ],
      env: {
        node: true,
      },
      rules: {
        'no-console': 0,
        'no-process-exit': 0,
      },
    },
  ]
};
