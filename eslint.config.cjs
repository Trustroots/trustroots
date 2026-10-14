const { FlatCompat } = require('@eslint/eslintrc');
const { fixupConfigRules } = require('@eslint/compat');
const js = require('@eslint/js');
const fs = require('fs');
const path = require('path');
const { defineConfig } = require('eslint/config');
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
  // Preserve ESLint 8's treatment of unused catch bindings.
  'no-unused-vars': [2, { caughtErrors: 'none' }],
  'arrow-spacing': [2, { before: true, after: true }],
  'require-atomic-updates': 0,
  'import/first': 2,
  'prettier/prettier': 2,
};

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const legacyConfig = {
  // Keep linting scoped to this worktree (parent repo .eslintrc must not load).
  root: true,
  extends: ['eslint:recommended', 'plugin:import/errors', 'prettier'],
  rules,
  plugins: ['react', 'import', 'prettier'],
  settings: {
    'import/resolver': {
      node: true,
      webpack: {
        config: __dirname + '/config/webpack/webpack.config.js',
      },
    },
  },
  env: {
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    ecmaFeatures: { jsx: true },
  },
  overrides: [
    {
      files: ['modules/*/client/**/*.{js,ts,tsx}'],
      rules: {
        'react/no-danger': 2,
        'no-restricted-properties': [
          2,
          {
            property: 'innerHTML',
            message: 'Use text or a reviewed HTML boundary.',
          },
          {
            property: 'outerHTML',
            message: 'Use text or a reviewed HTML boundary.',
          },
          {
            property: 'insertAdjacentHTML',
            message: 'Use text or a reviewed HTML boundary.',
          },
          {
            object: 'document',
            property: 'write',
            message: 'Use React rendering.',
          },
          {
            object: 'document',
            property: 'writeln',
            message: 'Use React rendering.',
          },
        ],
      },
    },
    {
      // Full rich text is formatted on the server before reaching these views.
      files: [
        'modules/core/client/components/ReadMorePanel.tsx',
        'modules/core/client/components/TrEditor.tsx',
        'modules/messages/client/components/ThreadMessage.tsx',
        'modules/messages/client/components/ThreadReply.tsx',
        'modules/admin/client/components/AdminMessages.component.tsx',
        'modules/admin/client/components/AdminNotes.tsx',
        'modules/offers/client/components/OfferMeetListPage.component.tsx',
        'modules/search/client/components/SearchSidebarResults.component.tsx',
        'modules/tribes/client/components/TribeDetailPage.component.tsx',
      ],
      rules: { 'react/no-danger': 0 },
    },
    {
      // DOM parsing and the editor need access to their existing HTML boundary.
      files: [
        'modules/core/client/components/TrEditor.tsx',
        'modules/core/client/utils/filters.ts',
        'modules/messages/client/utils/message-content.ts',
      ],
      rules: { 'no-restricted-properties': 0 },
    },
    /**
     * Overrides for server side app files
     */
    {
      files: [
        '*.js',
        '*.mjs',
        '*.cjs',
        'config/**',
        'scripts/ci/**/*.mts',
        'scripts/e2e/**/*.mts',
        'tests/e2e/**/*.{ts,mts}',
        'playwright.config.cts',
        'migrations/**',
        'modules/*/shared/**/*.{js,ts,mts}',
        'modules/*/server/*.{js,mjs}',
        'modules/*/server/**/*.{js,mjs,mts}',
        'testutils/server/**',
        'testutils/common/**',
      ],
      env: {
        node: true,
      },
    },

    /** Native server implementations must not regain CommonJS syntax. */
    {
      files: [
        'modules/*/server/**/*.{mjs,mts}',
        'config/lib/**/*.mjs',
        'bin/**/*.mjs',
      ],
      rules: {
        'import/no-commonjs': 2,
        'import/no-dynamic-require': 2,
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
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2022,

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
        'modules/*/tests/client/*.{js,ts,tsx}',
        'modules/*/tests/client/**/*.{js,ts,tsx}',
        'testutils/client/*.{js,ts,tsx}',
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
     * TypeScript source in client code, tests and shared contracts.
     */
    {
      files: [
        'config/vite/**/*.{ts,tsx}',
        'scripts/ci/**/*.mts',
        'scripts/e2e/**/*.mts',
        'tests/e2e/**/*.{ts,mts}',
        'playwright.config.cts',
        'modules/*/client/**/*.{ts,tsx}',
        'modules/*/shared/**/*.{ts,tsx,mts}',
        'modules/*/server/**/*.mts',
        'config/**/*.d.mts',
        'modules/*/tests/client/**/*.{ts,tsx,mts}',
        'testutils/client/**/*.{ts,tsx}',
        'testutils/common/**/*.{mts,ts}',
        'testutils/server/**/*.mts',
        'modules/*/tests/fixtures/**/*.mts',
      ],
      parser: '@typescript-eslint/parser',
      extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      rules: {
        'react/prop-types': 0,
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
      files: [
        'bin/**',
        'config/**',
        'migrations/**',
        'scripts/ci/**/*.mts',
        'scripts/e2e/**/*.mts',
      ],
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

// Share the existing ignore list with Prettier; flat config owns lint ignores.
const ignores = fs
  .readFileSync(path.join(__dirname, '.prettierignore'), 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
  .map(pattern =>
    !pattern.startsWith('!') && pattern.endsWith('/')
      ? `${pattern}**`
      : pattern,
  );

module.exports = defineConfig([
  // ESLint 8 ignored dotfiles and hidden directories by default.
  { ignores: [...ignores, '**/.*'] },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    extends: fixupConfigRules(compat.config(legacyConfig)),
  },
  {
    files: ['playwright.config.cts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.{cjs,cts}'],
    languageOptions: { sourceType: 'commonjs' },
  },
]);
