import { createRequire } from 'node:module';
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

const explicitFiles = process.env.SERVER_TEST_FILES?.split(',').filter(Boolean);

// Vitest otherwise orders files by size and past duration. The files share
// process state, so keep the order they always ran in: the order given in
// SERVER_TEST_FILES, otherwise sorted by code unit like the old glob runner.
class PathSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    const rank = (file: TestSpecification) => {
      const index = explicitFiles?.findIndex(
        entry => file.moduleId === entry || file.moduleId.endsWith(`/${entry}`),
      );
      return index ?? -1;
    };
    return [...files].sort((a, b) => {
      if (explicitFiles) return rank(a) - rank(b);
      return a.moduleId < b.moduleId ? -1 : a.moduleId > b.moduleId ? 1 : 0;
    });
  }
}

// The suite shares one Mongoose connection and mutates module singletons, so
// every file runs in the same process, in order, as it did under Mocha.
export default defineConfig({
  test: {
    include: explicitFiles ?? ['modules/*/tests/server/**/*.{js,cts,mts}'],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    isolate: false,
    // Node strips TypeScript without moving source offsets. Use that same
    // native loader for tests and application modules so V8 coverage maps to
    // the code actually executed, rather than Vite's transformed source.
    experimental: { viteModuleRunner: false },
    sequence: { sequencer: PathSequencer },
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
