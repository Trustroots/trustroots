const assert = require('assert');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {
  isMutable,
  mutatePatterns,
  planFull,
  planScope,
  relativeImports,
} = require('../../../../../scripts/mutation/server-scope.cts');

interface Shard {
  name: string;
  files: string[];
  reasons: string[];
  tests?: string[];
}

const files = [
  'modules/core/server/controllers/core.server.controller.mts',
  'modules/core/server/services/file-removal.server.service.mts',
  'modules/core/server/jobs/send-push-message.server.job.mjs',
  'modules/core/tests/server/core.server.routes.tests.cts',
  'modules/offers/server/controllers/offers.server.controller.mts',
  'modules/offers/server/models/offer.server.model.mts',
  'modules/offers/server/offer.server.model.mts',
  'modules/offers/tests/server/offer.server.routes.tests.cts',
  'modules/offers/tests/server/helpers/offer-fixtures.cts',
  'modules/users/server/jobs/user-welcome-sequence-first.server.job.mts',
  'modules/users/server/services/user-mini.server.service.mts',
  'modules/users/tests/server/user-mini.server.service.unit.tests.cts',
  'modules/mobile/server/mobile.server.routes.cjs',
  'packages/logger/logger.mts',
  'packages/logger/node_modules/dep/index.mts',
  'packages/analytics/server/umami.server.service.mts',
  'testutils/server/vitest.setup.mts',
  'README.md',
];

function plan(
  changes: Array<{ status: string; path: string; oldPath?: string }>,
  contents: Record<string, Record<string, string>> = {},
): Shard[] {
  return planScope({
    changes,
    files,
    read: (version: 'base' | 'head', file: string) => contents[version]?.[file],
  });
}

const names = (shards: Shard[]) => shards.map(shard => shard.name);

describe('mutation scope', () => {
  it('mutates the same files as the server coverage report', () => {
    assert.deepStrictEqual(files.filter(isMutable), [
      'modules/core/server/controllers/core.server.controller.mts',
      'modules/offers/server/controllers/offers.server.controller.mts',
      'modules/users/server/services/user-mini.server.service.mts',
      'packages/logger/logger.mts',
      'packages/analytics/server/umami.server.service.mts',
    ]);
    assert.ok(mutatePatterns.includes('modules/*/server/**/*.{mjs,mts}'));
    assert.ok(
      mutatePatterns.includes(
        '!modules/core/server/services/file-removal.server.service.mts',
      ),
    );
  });

  it('shares its mutate list with the Stryker server config', async () => {
    const { default: config } =
      await import('../../../../../stryker.server.config.mjs');
    assert.strictEqual(config.mutate, mutatePatterns);
  });

  it('mutates a changed source file on its own', () => {
    const shards = plan([
      {
        status: 'M',
        path: 'modules/offers/server/controllers/offers.server.controller.mts',
      },
      { status: 'M', path: 'README.md' },
    ]);
    assert.deepStrictEqual(shards, [
      {
        name: 'offers',
        files: [
          'modules/offers/server/controllers/offers.server.controller.mts',
        ],
        reasons: [
          'source changed: modules/offers/server/controllers/offers.server.controller.mts',
        ],
      },
    ]);
  });

  it('skips deleted and unmutated source files', () => {
    assert.deepStrictEqual(
      plan([
        {
          status: 'D',
          path: 'modules/offers/server/controllers/offers.server.controller.mts',
        },
        { status: 'M', path: 'modules/offers/server/offer.server.model.mts' },
        { status: 'M', path: 'modules/mobile/server/mobile.server.routes.cjs' },
      ]),
      [],
    );
  });

  it('leaves package shards to the full run, against their own tests', () => {
    const changes = [
      { status: 'A', path: 'packages/logger/logger.mts' },
      {
        status: 'M',
        path: 'packages/analytics/server/umami.server.service.mts',
      },
    ];
    assert.deepStrictEqual(plan(changes), []);
    const full = planFull(files, 'full run');
    for (const name of ['package-analytics', 'package-logger']) {
      const shard = full.find((s: Shard) => s.name === name);
      assert.ok(shard.tests.length > 0);
      for (const test of shard.tests) assert.ok(fs.existsSync(test), test);
    }
    assert.ok(full.filter((s: Shard) => s.tests).length === 2);
  });

  it('gives password hashing a shard of its own', () => {
    const service =
      'modules/users/server/services/password-hashing.server.service';
    const sources = ['a', 'b', 'c', 'd'].map(
      name => `modules/users/server/services/${name}.server.service.mts`,
    );
    const shards = planFull(
      [...sources, `${service}.mjs`, `${service}.mts`],
      'full run',
    );
    assert.deepStrictEqual(
      shards.map((s: Shard) => [s.name, s.files]),
      [
        ['users', sources],
        ['users-password-hashing', [`${service}.mjs`, `${service}.mts`]],
      ],
    );
  });

  it('mutates the whole module when one of its server tests changes', () => {
    for (const status of ['A', 'M', 'D']) {
      const shards = plan([
        {
          status,
          path: 'modules/offers/tests/server/offer.server.routes.tests.cts',
        },
      ]);
      assert.deepStrictEqual(shards, [
        {
          name: 'offers',
          files: [
            'modules/offers/server/controllers/offers.server.controller.mts',
          ],
          reasons: [
            'server test changed: modules/offers/tests/server/offer.server.routes.tests.cts',
          ],
        },
      ]);
    }
  });

  it('treats test helpers as tests of their module', () => {
    assert.deepStrictEqual(
      names(
        plan([
          {
            status: 'M',
            path: 'modules/offers/tests/server/helpers/offer-fixtures.cts',
          },
        ]),
      ),
      ['offers'],
    );
  });

  it('maps a renamed test from its old and new module', () => {
    assert.deepStrictEqual(
      names(
        plan([
          {
            status: 'R',
            oldPath:
              'modules/offers/tests/server/offer.server.routes.tests.cts',
            path: 'modules/users/tests/server/offer.server.routes.tests.cts',
          },
        ]),
      ),
      ['offers', 'users'],
    );
  });

  it('adds source in other modules that a test imports, old or new', () => {
    const test =
      'modules/users/tests/server/user-mini.server.service.unit.tests.cts';
    const shards = plan([{ status: 'M', path: test }], {
      base: {
        [test]:
          "const core = require('../../../core/server/controllers/core.server.controller.mts');",
      },
      head: {
        [test]: [
          "import logger from '../../../../packages/logger/logger';",
          "import fixtures from '../../../offers/server/offer.server.model.mts';",
          "import missing from './not-a-source.mts';",
          "import { mini } from '../../server/services/user-mini.server.service.mts';",
        ].join('\n'),
      },
    });
    assert.deepStrictEqual(
      shards.map(shard => [shard.name, shard.files]),
      [
        [
          'core',
          ['modules/core/server/controllers/core.server.controller.mts'],
        ],
        [
          'users',
          ['modules/users/server/services/user-mini.server.service.mts'],
        ],
      ],
    );
    for (const shard of shards) {
      assert.deepStrictEqual(shard.reasons, [`server test changed: ${test}`]);
    }
  });

  it('reads the deleted version of a test for its imports', () => {
    const test =
      'modules/users/tests/server/user-mini.server.service.unit.tests.cts';
    const shards = plan([{ status: 'D', path: test }], {
      base: {
        [test]:
          "const offers = require('../../../offers/server/controllers/offers.server.controller.mts');",
      },
    });
    assert.deepStrictEqual(names(shards), ['offers', 'users']);
  });

  it('mutates the whole server when shared test infrastructure changes', () => {
    for (const changed of [
      'testutils/server/vitest.setup.mts',
      'vitest.server.config.mts',
      'vitest.stryker.server.config.mts',
      'stryker.server.config.mjs',
      'scripts/mutation/server-scope.cts',
      'tooling/stryker/ignore-export-names.mjs',
      'tooling/baselines/mutation.json',
    ]) {
      const shards = plan([{ status: 'M', path: changed }]);
      assert.deepStrictEqual(
        shards,
        planFull(
          files,
          `shared test infrastructure changed: ${changed}`,
        ).filter((shard: Shard) => !shard.tests),
      );
      assert.deepStrictEqual(names(shards), ['core', 'offers', 'users']);
    }
    assert.deepStrictEqual(
      names(
        plan([
          {
            status: 'R',
            oldPath: 'testutils/server/vitest.setup.mts',
            path: 'testutils/vitest.setup.mts',
          },
        ]),
      ),
      ['core', 'offers', 'users'],
    );
  });

  it('plans the full run as one shard per module', () => {
    const shards = planFull(files, 'full run');
    assert.deepStrictEqual(shards[0], {
      name: 'core',
      files: ['modules/core/server/controllers/core.server.controller.mts'],
      reasons: ['full run'],
    });
    assert.strictEqual(
      shards.reduce(
        (total: number, shard: Shard) => total + shard.files.length,
        0,
      ),
      files.filter(isMutable).length,
    );
  });

  it('splits a large module into shards of at most four source files', () => {
    const sources = [
      'a.server.service',
      'b.server.service',
      'c.server.service',
      'd.server.service',
      'e.server.service',
      'f.server.service',
      'g.server.service',
      'h.server.service',
      'i.server.service',
    ].map(name => `modules/users/server/services/${name}.mts`);
    // A CommonJS shim stays in the shard of the source it re-exports.
    const shim = 'modules/users/server/services/d.server.service.mjs';
    const shards = planFull(
      [...sources, shim, 'modules/core/server/core.server.routes.mts'],
      'full run',
    );

    assert.deepStrictEqual(names(shards), [
      'core',
      'users-1',
      'users-2',
      'users-3',
    ]);
    assert.deepStrictEqual(shards[1].files, [
      ...sources.slice(0, 3),
      shim,
      sources[3],
    ]);
    assert.deepStrictEqual(shards[2].files, sources.slice(4, 8));
    assert.deepStrictEqual(shards[3].files, sources.slice(8));
    for (const shard of shards)
      assert.deepStrictEqual(shard.reasons, ['full run']);

    const scoped = planScope({
      changes: [
        { status: 'M', path: 'modules/users/tests/server/x.tests.cts' },
      ],
      files: sources,
      read: () => undefined,
    });
    assert.deepStrictEqual(names(scoped), ['users-1', 'users-2', 'users-3']);
    assert.deepStrictEqual(scoped[2].reasons, [
      'server test changed: modules/users/tests/server/x.tests.cts',
    ]);
  });

  it('finds relative require, import and dynamic import specifiers', () => {
    assert.deepStrictEqual(
      relativeImports(
        [
          "const a = require('./a.mts');",
          'const b = require( "../b.mjs" );',
          "import c from './c.mts';",
          "import { d } from '../d';",
          "import './e.mts';",
          "const f = await import('./f.mts');",
          "const g = require('lodash');",
          "import h from 'node:path';",
        ].join('\n'),
      ).sort(),
      ['../b.mjs', '../d', './a.mts', './c.mts', './e.mts', './f.mts'],
    );
  });

  it('is what the mutation workflow runs', () => {
    const root = path.resolve(__dirname, '../../../../..');
    const workflow = yaml.load(
      fs.readFileSync(
        path.join(root, '.github/workflows/mutation.yml'),
        'utf8',
      ),
    );
    const plan = workflow.jobs.plan.steps.find(
      (step: { id?: string }) => step.id === 'plan',
    );
    assert.match(plan.run, /server-scope\.cts --base="\$BASE_SHA"/);
    assert.match(plan.run, /server-scope\.cts --full/);
    assert.ok(workflow.on.schedule.length > 0);
    assert.ok('workflow_dispatch' in workflow.on);
  });
});
