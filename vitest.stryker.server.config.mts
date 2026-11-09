// The server Vitest config, as run by Stryker. Each Stryker worker runs its
// own Vitest, so give each one its own database: the suite drops its database
// on start, and two runs sharing one would wipe each other's data.
import { BaseSequencer, type TestSpecification } from 'vitest/node';

import config from './vitest.server.config.mts';

// Stryker records the first test that kills each mutant. Run the focused
// `*.unit.tests.*` files before the integration files, so a mutant is
// credited to a unit test when one catches it; otherwise keep path order.
class UnitFirstSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    const unit = (file: TestSpecification) =>
      /\.unit\.tests\./.test(file.moduleId) ? 0 : 1;
    return [...files].sort(
      (a, b) =>
        unit(a) - unit(b) ||
        (a.moduleId < b.moduleId ? -1 : a.moduleId > b.moduleId ? 1 : 0),
    );
  }
}

const worker = Number(process.env.STRYKER_MUTATOR_WORKER ?? 0);
process.env.NODE_ENV = 'test';
process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG = 'true';
process.env.TRUSTROOTS_SERVER_TEST_DATABASE = `trustroots-test-worker-5772796b6572-${(worker % 8) + 1}`;

// These files check the source itself rather than its behaviour: they run the
// TypeScript compiler over it, or assert on V8 coverage of it. Stryker's
// instrumented copy (with `// @ts-nocheck` and mutant switches) fails them,
// and they can't kill a runtime mutant, so leave them out of mutation runs.
const sourceChecks = [
  'modules/*/tests/server/**/*.server.types.tests.cts',
  'modules/core/tests/server/scripts/server-native-coverage.unit.tests.cts',
];

// A shard can name the only test files it runs (`tests` in
// scripts/mutation/server-scope.cts); the workflow passes them here.
const shardTests = process.env.STRYKER_TEST_FILES?.split(',').filter(Boolean);

export default {
  ...config,
  test: {
    ...config.test,
    ...(shardTests?.length && { include: shardTests }),
    exclude: [
      ...(config.test?.exclude ?? ['**/node_modules/**']),
      ...sourceChecks,
    ],
    // A mutant that breaks a request handler leaves each covering test waiting
    // for its timeout. Fail those fast: no server test needs 3s on its own,
    // though the shared CI runners are about twice as slow as a laptop.
    testTimeout: process.env.CI ? 6000 : 3000,
    sequence: { ...config.test?.sequence, sequencer: UnitFirstSequencer },
  },
};
