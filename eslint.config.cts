const { FlatCompat } = require('@eslint/eslintrc');
const { fixupConfigRules } = require('@eslint/compat');
const js = require('@eslint/js');
const fs = require('fs');
const path = require('path');
const { defineConfig } = require('eslint/config');
const semver = require('semver');
const { defaultExtensionAlias } = require('eslint-import-resolver-typescript');
const {
  jsExtensionAlias,
  resolverAliases,
} = require('./config/client/aliases.mts');

// Passing extensionAlias replaces the resolver default. Keep every other
// mapping, and only prefer the shared `.js` order ahead of leftovers such as
// `.d.ts`.
const extensionAlias = {
  ...defaultExtensionAlias,
  '.js': [
    ...jsExtensionAlias,
    ...defaultExtensionAlias['.js'].filter(
      (extension: string) => !jsExtensionAlias.includes(extension),
    ),
  ],
};

// Converts semver range `~16.6.0` to strict version `16.6.0`
const coercedReactVersion = semver.coerce(
  require('./package.json').dependencies.react,
);
if (!coercedReactVersion) throw new Error('Could not determine React version');
const reactVersion = coercedReactVersion.version;

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
    {
      newIsCapExceptions: ['acl.memoryBackend', 'acl', 'useQueryClient'],
      capIsNewExceptions: ['mongoose.Types.ObjectId'],
    },
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
      typescript: {
        project: path.join(__dirname, 'tsconfig.json'),
        alias: resolverAliases(),
        extensionAlias,
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
      files: ['apps/nostranslation/**/*.{ts,tsx,mts}'],
      parser: '@typescript-eslint/parser',
      extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
      env: { browser: true, node: true, jest: true },
      rules: {
        'react/prop-types': 0,
        'no-use-before-define': 0,
        'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
        'import/named': 0,
      },
    },
    {
      files: [
        'modules/*/client/**/*.{js,ts,tsx}',
        'layers/shell/**/*.{js,ts,tsx}',
      ],
      extends: ['plugin:jsx-a11y/recommended'],
      rules: {
        // Custom editors manage focus themselves; native autoFocus stays banned.
        'jsx-a11y/no-autofocus': [2, { ignoreNonDOM: true }],
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
      // These two boundaries sanitise markup before inserting it.
      files: [
        'modules/core/client/components/RichText.tsx',
        'modules/core/client/components/TrEditor.tsx',
      ],
      rules: { 'react/no-danger': 0 },
    },
    {
      // DOM parsing and the editor need access to their existing HTML boundary.
      files: [
        'modules/core/client/components/TrEditor.tsx',
        'modules/core/client/utils/filters.ts',
        'modules/core/client/utils/rich-text.ts',
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
        '*.mts',
        '*.cjs',
        'config/**',
        'scripts/**/*.{mts,cts}',
        'tests/e2e/**/*.{ts,mts}',
        'playwright.config.cts',
        'migrations/**',
        'modules/*/shared/**/*.{js,ts,mts}',
        'modules/*/server/*.{js,mjs}',
        'modules/*/server/**/*.{js,mjs,mts}',
        'testutils/server/**',
        'packages/logger/**',
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
        'config/lib/**/*.{mjs,mts}',
        'packages/logger/**/*.mts',
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
        'layers/shell/**',
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
        'plugin:jest-dom/recommended',
        'prettier',
      ],
      plugins: ['testing-library'],
      // Keep the v3 React preset's policy when upgrading the plugin. Newer
      // presets also enforce test style rules across the existing suite.
      rules: {
        'testing-library/await-async-queries': 'error',
        'testing-library/await-async-utils': 'error',
        'testing-library/no-await-sync-queries': 'error',
        'testing-library/no-debugging-utils': 'warn',
        'testing-library/no-dom-import': ['error', 'react'],
      },
      settings: {
        react: {
          version: reactVersion,
        },
      },
      env: {
        browser: true,
        jest: true,
        jasmine: true,
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
        '*.{cts,mts}',
        'config/**/*.{cts,mts,ts,tsx}',
        'config/vite/**/*.{ts,tsx,mts}',
        'worker.mts',
        'jest/**/*.cts',
        'bin/**/*.mts',
        'scripts/**/*.{mts,cts}',
        'tests/e2e/**/*.{ts,mts}',
        'playwright.config.cts',
        'layers/shell/**/*.{ts,tsx}',
        'modules/*/client/**/*.{ts,tsx}',
        'modules/*/shared/**/*.{ts,tsx,mts}',
        'modules/*/server/**/*.mts',
        'config/**/*.d.mts',
        'config/lib/**/*.mts',
        'packages/logger/**/*.mts',
        'modules/*/tests/client/**/*.{ts,tsx,mts}',
        'modules/*/tests/server/**/*.{cts,mts}',
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

    {
      files: ['tests/e2e/**/*.{ts,mts}'],
      // The strict E2E compiler checks named exports. ESLint cannot follow
      // Playwright's CommonJS re-exports consistently across platforms.
      rules: { 'import/named': 0 },
    },

    /**
     * Overrides for server side test files
     */
    {
      files: [
        'modules/*/tests/server/*.{js,cts,mts}',
        'modules/*/tests/server/**/*.{js,cts,mts}',
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
        'scripts/**/*.{mts,cts}',
        'tooling/guards/**/*.mts',
        'packages/logger/**',
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
const ignores = (
  fs.readFileSync(path.join(__dirname, '.prettierignore'), 'utf8') as string
)
  .split(/\r?\n/)
  .map((line: string) => line.trim())
  .filter((line: string) => line && !line.startsWith('#'))
  .map((pattern: string) =>
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
    files: [
      '*.cts',
      'config/**/*.cts',
      'playwright.config.cts',
      'modules/*/tests/server/**/*.cts',
      'scripts/**/*.cts',
    ],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['jest/**/*.cts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.{cjs,cts}'],
    languageOptions: { sourceType: 'commonjs' },
  },
]);
