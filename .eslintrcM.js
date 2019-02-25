const es2018rules = {
  'no-var': 2,
  'prefer-const': 2,
  'arrow-spacing': [2, { before: true, after: true }]
};

module.exports = {
  /*
   * this would ideally belong to the react overrides, but overrides can't include extends
   * https://github.com/eslint/eslint/issues/8813
   */
  extends: [
    'plugin:react/recommended'
  ],
  settings: {
    react: {
      version: '16.6'
    }
  },
  rules: {
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
    'no-console': 0,
    'no-else-return': 0,
    'no-empty-character-class': 2,
    'no-multi-spaces': 2,
    'no-param-reassign': 0,
    'no-shadow': 0,
    'no-spaced-func': 2,
    'no-throw-literal': 2,
    'no-trailing-spaces': 2,
    'no-undef': 2,
    'no-unneeded-ternary': 2,
    'no-unreachable': 2,
    'no-underscore-dangle': 0,
    'no-unused-expressions': 0,
    'no-unused-vars': 2,
    'no-use-before-define': [1, 'nofunc'],
    'no-var': 0,
    'object-curly-spacing': [2, 'always'],
    'one-var': [0, 'never'],
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
    'vars-on-top': 0
  },
  env: {
    node: true,
    browser: true,
    jasmine: true,
    mocha: true,
    jquery: true
  },
  globals: {
    angular: true,
    PruneCluster: true,
    PruneClusterForLeaflet: true,
    PhusionPassenger: true,
    L: true,
    by: true,
    browser: true,
    element: true,
    inject: true,
    io: true,
    moment: true,
    Promise: true,
    __TESTING__: true,
    _: false,
    AppConfig: true
  },
  /*
    eventually, after the migration, these overrides will become the main rules
    it would be nice to keep the rules for client and server separate,
    because eventually, they want to become independent codebases.
  */
  overrides: [{
    // overrides for server code
    // ES 2018 - specify migrated files and folders here
    files: [
      'testutils/data.server.testutils.js',
      'modules/references/server/**',
      'modules/references/tests/server/**'
    ],
    parserOptions: {
      ecmaVersion: 2018
    },
    rules: es2018rules
  }, {
    // overrides for client/react code
    files: [
      'config/webpack/**',
      'config/lib/i18n.js',
      'modules/core/client/app/config.js',
      'modules/**/client/components/**',
      'modules/core/client/directives/tr-boards.client.directive.js',
      'modules/core/client/services/photos.service.js',
      'modules/utils/**'
    ],
    parserOptions: {
      ecmaVersion: 2018,
      sourceType: 'module'
    },
    rules: es2018rules
  }]
};
