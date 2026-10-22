import { createRequire } from 'node:module';
import { transformWithOxc } from 'vite';
import { defineConfig, type ViteUserConfig } from 'vitest/config';
import {
  BaseSequencer,
  type TestModule,
  type TestSpecification,
} from 'vitest/node';

const require = createRequire(import.meta.url);
const { recordTimings } = require('./scripts/server-test-timings.cts') as {
  recordTimings(modules: readonly TestModule[], output: string): void;
};

// Parallel workers write blob reports, which the parent merges into one
// coverage report.
const blobOutput = process.env.SERVER_TEST_BLOB_OUTPUT;
const timingsOutput = process.env.SERVER_TEST_TIMINGS_OUTPUT;
const reporters: NonNullable<ViteUserConfig['test']>['reporters'] = [
  'default',
  ...(blobOutput ? ['blob'] : []),
  ...(timingsOutput
    ? [
        {
          onTestRunEnd(modules: readonly TestModule[]) {
            recordTimings(modules, timingsOutput);
          },
        },
      ]
    : []),
];

// Vite's TypeScript transform skips .cts, which the server tests are written in.
const commonJsTypeScript = {
  name: 'trustroots-cts',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.endsWith('.cts')) return null;
    return transformWithOxc(code, id.replace(/\.cts$/, '.ts'));
  },
};

// Vitest otherwise orders files by size and past duration. The files share
// process state, so keep the alphabetical order they always ran in.
class PathSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

// The suite shares one Mongoose connection and mutates module singletons, so
// every file runs in the same process, in order, as it did under Mocha.
export default defineConfig({
  plugins: [commonJsTypeScript],
  test: {
    include: process.env.SERVER_TEST_FILES
      ? process.env.SERVER_TEST_FILES.split(',').filter(Boolean)
      : ['modules/*/tests/server/**/*.{js,cts,mts}'],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    isolate: false,
    sequence: { sequencer: PathSequencer },
    // Tests mix require() and import(); loading application code natively keeps
    // one module instance for both, as it was under Mocha.
    server: {
      deps: {
        external: [
          /\/(?:modules|config|testutils|bin)\/(?!.*\/tests\/server\/)/,
        ],
      },
    },
    reporters,
    ...(blobOutput ? { outputFile: { blob: blobOutput } } : {}),
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./testutils/server/vitest.setup.mts'],
    coverage: {
      provider: 'v8',
      include: ['modules/*/server/**/*.{mjs,mts}'],
      exclude: [
        'modules/*/tests/**',
        'deploy/docker/data/**',
        'modules/*/server/**/*.model.{mjs,mts}',
        'modules/*/server/models/**',
        'modules/core/server/jobs/send-push-message.server.job.mjs',
        'modules/users/server/jobs/user-welcome-sequence-first.server.job.{mjs,mts}',
        'modules/users/server/jobs/user-welcome-sequence-second.server.job.{mjs,mts}',
        'modules/users/server/jobs/user-welcome-sequence-third.server.job.{mjs,mts}',
      ],
      // Parallel workers must not clean or read each other's raw coverage data.
      reportsDirectory:
        process.env.SERVER_TEST_COVERAGE_OUTPUT ?? 'coverage/server',
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
    },
  },
});
