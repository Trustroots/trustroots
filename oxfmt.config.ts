import { defineConfig } from 'oxfmt';

// Shared with oxlint.config.ts.
export const ignorePatterns = [
  'node_modules/',
  'coverage/',
  'coverage-report/',
  'playwright-report/',
  'test-results/',
  'tests/e2e/.auth/',
  'tmp/',
  'logs/',
  'log/',
  '*.log',
  'build/',
  'apps/android/build/',
  'apps/android/app/build/',
  'apps/shared/build/',
  'public/lib/',
  'public/dist/',
  'public/assets/',
  'public/push-messaging-sw.js',
  'uploads/',
  'public/uploads-profile/',
  'public/uploads-circle/',
  'modules/users/client/img/profile/uploads',
  'bin/admin/*',
  '!bin/admin/*.mts',
  '!bin/admin/*.cts',
  'deploy',
  'public',
  'scripts/**',
  '!scripts/**/',
  '!scripts/**/*.mts',
  '!scripts/**/*.cts',
  'modules/core/server/views/email-templates/',
  'modules/core/server/views/email-templates-text/',
  '.github/**/*.md',
  // Nunjucks tags inside attributes are not parseable as HTML.
  'modules/core/server/views/react-head.server.view.html',
  'docs/assets/js/',
  'docs/assets/downloads/',
  'apps/nostranslation/build/',
  'layers/shell/client/routeTree.gen.ts',
  // Written by the coverage, mutation and module graph scripts.
  'tooling/baselines/',
];

export default defineConfig({
  printWidth: 80,
  arrowParens: 'avoid',
  singleQuote: true,
  trailingComma: 'all',
  sortPackageJson: false,
  // Prettier ignored .editorconfig's JSON setting; keep the final newline.
  insertFinalNewline: true,
  ignorePatterns,
});
