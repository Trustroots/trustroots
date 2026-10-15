import type {} from 'node:assert';

const assert: typeof import('node:assert') = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');
const {
  summariseDependencies,
  collectDependencyChanges,
  renderDependencyChanges,
  renderProductionInventory,
} = require('../../../../../scripts/coverage/dependency-changes.cts');
const {
  collectInstalledPackages,
} = require('../../../../../scripts/ci/production-dependencies.cts');
const {
  renderLineChanges,
  summariseNumstat,
  updateLineChangesComment,
} = require('../../../../../scripts/coverage/line-changes.cts');
const {
  buildMarkdown,
} = require('../../../../../scripts/coverage/generate-pr-summary.cts');

interface DependencyChange {
  name: string;
  before: string | undefined;
  after: string | undefined;
}

interface DependencyGroup {
  added: number;
  removed: number;
  changed: number;
  net: number;
  changes: DependencyChange[];
}

interface WorkflowStep {
  name?: string;
  run?: string;
  with?: Record<string, string>;
}

interface WorkflowJob {
  needs: string[];
  steps: WorkflowStep[];
}

describe('PR dependency summaries', () => {
  it('loads JSON and YAML NYC configuration with the shared YAML 4 dependency', async () => {
    const loaderRequire = createRequire(
      require.resolve('@istanbuljs/load-nyc-config'),
    );
    assert.strictEqual(loaderRequire('js-yaml/package.json').version, '4.3.2');
    const { loadNycConfig } = require('@istanbuljs/load-nyc-config');
    const root = path.resolve(__dirname, '../../../../..');
    const config = await loadNycConfig({
      cwd: root,
      nycrcPath: '.nycrc-server',
    });
    assert.deepStrictEqual(config.include, ['modules/*/server/**/*.{mjs,mts}']);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fictional-nyc-'));
    try {
      fs.writeFileSync(
        path.join(directory, '.nycrc.yml'),
        'all: true\ninclude:\n  - src/**/*.js\n',
      );
      const yamlConfig = await loadNycConfig({ cwd: directory });
      assert.strictEqual(yamlConfig.all, true);
      assert.deepStrictEqual(yamlConfig.include, ['src/**/*.js']);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  const before = {
    manifest: {
      dependencies: { fictional: '^1', removed: '1' },
      devDependencies: { builder: '1' },
    },
    lock: {
      packages: {
        '': { version: '1' },
        'node_modules/fictional': { version: '1' },
        'node_modules/removed': { version: '1' },
      },
    },
  };
  const after = {
    manifest: { dependencies: { fictional: '^2', added: '1' } },
    lock: {
      packages: {
        'node_modules/fictional': { version: '2' },
        'node_modules/added': { version: '1' },
        'node_modules/linked': { link: true },
      },
    },
  };
  it('separates additions, removals and updates without counting the project root', () => {
    const groups = summariseDependencies(before, after) as DependencyGroup[];
    assert.deepStrictEqual(
      groups.map(({ added, removed, changed, net }) => [
        added,
        removed,
        changed,
        net,
      ]),
      [
        [1, 1, 1, 0],
        [0, 1, 0, -1],
        [1, 1, 1, 0],
      ],
    );
    const text = renderDependencyChanges(groups);
    assert.match(
      text,
      /Direct development dependencies \| ⚪ 0 \| 🟢 −1 \| ⚪ 0 \| \*\*🟢 −1\*\*/,
    );
    assert.match(
      text,
      /Direct runtime dependencies \| 🔵 \+1 \| 🟢 −1 \| 🟡 1 \| \*\*⚪ 0\*\*/,
    );
    assert.match(text, /Colours indicate change types, not dependency quality/);
    assert.match(text, /fictional \| \^1 \| \^2/);
    assert.match(text, /node_modules\/fictional \| 1 \| 2/);
    assert.match(text, /must not be added together/);
    assert.match(text, /do not measure production Docker pruning/);
  });
  it('handles empty inventories, additions and hostile Markdown as data', () => {
    const empty = { manifest: {}, lock: {} };
    assert.match(
      renderDependencyChanges(summariseDependencies(empty, empty)),
      /No dependency declaration/,
    );
    const text = renderDependencyChanges(
      summariseDependencies(empty, {
        manifest: { dependencies: { '<script>|`\n': '1' } },
        lock: {},
      }),
    );
    assert.match(text, /\+1/);
    assert.match(text, /\*\*🔵 \+1\*\*/);
    assert.doesNotMatch(text, /<script>/);
    assert.match(text, /&#124;/);
    assert.throws(
      () => collectDependencyChanges('invalid', 'head'),
      /commit SHAs/,
    );
    const many = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`fictional-${index}`, '1']),
    );
    assert.match(
      renderDependencyChanges(
        summariseDependencies(empty, {
          manifest: { dependencies: many },
          lock: {},
        }),
      ),
      /first 100 of 101/,
    );
  });
  it('refreshes the existing section without duplicating it or losing coverage', () => {
    const summary = {
      ...summariseNumstat(''),
      dependencies: summariseDependencies(before, after),
    };
    const first = updateLineChangesComment('Coverage: 100%\n', summary);
    const second = updateLineChangesComment(first, summary);
    assert.strictEqual(second.split('### Dependency changes').length, 2);
    assert.match(second, /Coverage: 100%/);
    assert.match(renderLineChanges(summary), /Dependency details/);
    // The trusted workflow still uses main's older line-only renderer until
    // this PR merges. Its refresh must leave the new dependency section intact.
    const legacyRefresh = second.replace(
      /<!-- trustroots-line-changes:start -->[\s\S]*?<!-- trustroots-line-changes:end -->/,
      renderLineChanges(summariseNumstat('')),
    );
    assert.match(legacyRefresh, /Dependency details/);
    const refreshed = updateLineChangesComment(legacyRefresh, summary);
    assert.strictEqual(refreshed.split('### Dependency changes').length, 2);
    assert.match(refreshed, /Coverage: 100%/);
    for (const includeCoverage of [true, false]) {
      const output = buildMarkdown([], {
        lineChanges: summary,
        includeCoverage,
      });
      assert.match(output, /Dependency changes/);
      assert.match(output, /Installed inventory unavailable/);
    }
  });
  it('compares commits with missing manifest and lockfile inventories', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fictional-dependency-git-'),
    );
    const git = (args: string[]) =>
      execFileSync('git', args, {
        cwd: directory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    try {
      git(['init', '-b', 'main']);
      fs.writeFileSync(
        path.join(directory, 'README.md'),
        'Fixture repository\n',
      );
      const commit = () => {
        git(['add', '.']);
        git([
          '-c',
          'user.name=Fixture Member',
          '-c',
          'user.email=fixture@example.test',
          'commit',
          '-m',
          'Fixture',
        ]);
        return git(['rev-parse', 'HEAD']);
      };
      const base = commit();
      fs.writeFileSync(
        path.join(directory, 'package.json'),
        JSON.stringify({ dependencies: { fictional: '1' } }),
      );
      fs.writeFileSync(
        path.join(directory, 'package-lock.json'),
        JSON.stringify({
          packages: { 'node_modules/fictional': { version: '1' } },
        }),
      );
      const head = commit();
      assert.strictEqual(
        collectDependencyChanges(base, head, directory)[0].added,
        1,
      );
      fs.unlinkSync(path.join(directory, 'package.json'));
      fs.unlinkSync(path.join(directory, 'package-lock.json'));
      assert.strictEqual(
        collectDependencyChanges(head, commit(), directory)[2].removed,
        1,
      );
      assert.throws(
        () => collectDependencyChanges(undefined, head, directory),
        /commit SHAs/,
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  it('connects the actual image inventory to the summary artifact download', () => {
    const root = path.resolve(__dirname, '../../../../..');
    const workflow = require('js-yaml').load(
      fs.readFileSync(path.join(root, '.github/workflows/test.yml'), 'utf8'),
    ) as { jobs: Record<string, WorkflowJob> };
    const image = workflow.jobs['build-production-image'];
    const summary = workflow.jobs['coverage-summary'];
    assert.ok(summary.needs.includes('build-production-image'));
    const inventoryStep = image.steps.find(
      (step: WorkflowStep) =>
        step.name === 'Inventory installed production dependencies',
    );
    assert.ok(inventoryStep?.run);
    assert.match(
      inventoryStep.run,
      /docker run --rm -i --network none --entrypoint node trustroots:pr/,
    );
    assert.match(
      inventoryStep.run,
      /< scripts\/ci\/production-dependencies.cts > coverage\/production\/dependencies.json/,
    );
    assert.match(
      inventoryStep.run,
      /--input-type=commonjs-typescript - --inventory-stdin </,
    );
    assert.ok(
      image.steps.find(
        (step: WorkflowStep) =>
          step.with && step.with.name === 'production-dependencies',
      ),
    );
    assert.ok(
      summary.steps.find(
        (step: WorkflowStep) =>
          step.with &&
          step.with.name === 'production-dependencies' &&
          step.with.path === 'coverage/production',
      ),
    );
  });
  it('reads resolved entries from a pnpm lockfile and treats version changes as updates', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fictional-pnpm-git-'),
    );
    const git = (args: string[]) =>
      execFileSync('git', args, {
        cwd: directory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    const commit = () => {
      git(['add', '.']);
      git([
        '-c',
        'user.name=Fixture Member',
        '-c',
        'user.email=fixture@example.test',
        'commit',
        '-m',
        'Fixture',
      ]);
      return git(['rev-parse', 'HEAD']);
    };
    const lockfile = (packages: string) =>
      `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    dependencies:\n      fictional:\n        specifier: 1.0.0\n        version: 1.0.0\n\npackages:\n\n${packages}\nsnapshots:\n\n  fictional@1.0.0: {}\n`;
    try {
      git(['init', '-b', 'main']);
      fs.writeFileSync(
        path.join(directory, 'pnpm-lock.yaml'),
        lockfile(
          "  fictional@1.0.0:\n    resolution: {integrity: sha512-x}\n\n  '@example/scoped@2.0.0':\n    resolution: {integrity: sha512-y}\n",
        ),
      );
      const base = commit();
      fs.writeFileSync(
        path.join(directory, 'pnpm-lock.yaml'),
        lockfile(
          "  fictional@1.0.0:\n    resolution: {integrity: sha512-x}\n\n  fictional@2.0.0:\n    resolution: {integrity: sha512-z}\n\n  '@example/scoped@2.0.0':\n    resolution: {integrity: sha512-y}\n\n  added@1.0.0:\n    resolution: {integrity: sha512-w}\n",
        ),
      );
      const [, , resolved] = collectDependencyChanges(
        base,
        commit(),
        directory,
      ) as DependencyGroup[];
      assert.deepStrictEqual(
        resolved.changes.map(({ name, before, after }) => [
          name,
          before,
          after,
        ]),
        [
          ['added', undefined, '1.0.0'],
          ['fictional', '1.0.0', '1.0.0, 2.0.0'],
        ],
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('inventories the real packages in a pnpm virtual store once, ignoring symlinks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fictional-pnpm-'));
    try {
      for (const [location, name, version] of [
        [
          'node_modules/.pnpm/fictional@1.0.0/node_modules/fictional',
          'fictional',
          '1.0.0',
        ],
        [
          'node_modules/.pnpm/@example+scoped@2.0.0/node_modules/@example/scoped',
          '@example/scoped',
          '2.0.0',
        ],
      ] as [string, string, string][]) {
        fs.mkdirSync(path.join(root, location), { recursive: true });
        fs.writeFileSync(
          path.join(root, location, 'package.json'),
          JSON.stringify({ name, version }),
        );
      }
      fs.symlinkSync(
        '.pnpm/fictional@1.0.0/node_modules/fictional',
        path.join(root, 'node_modules/fictional'),
      );
      fs.symlinkSync(
        '../../@example+scoped@2.0.0/node_modules/@example/scoped',
        path.join(
          root,
          'node_modules/.pnpm/fictional@1.0.0/node_modules/scoped',
        ),
      );
      assert.deepStrictEqual(
        collectInstalledPackages(root).map(
          ({ name, version }: { name: string; version: string }) => [
            name,
            version,
          ],
        ),
        [
          ['@example/scoped', '2.0.0'],
          ['fictional', '1.0.0'],
        ],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('inventories actual nested and scoped installations, including duplicate versions', function () {
    this.timeout(30000);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fictional-installed-'));
    try {
      assert.deepStrictEqual(collectInstalledPackages(root), []);
      for (const [location, name, version] of [
        ['node_modules/fictional', 'fictional', '1'],
        ['node_modules/@example/scoped', '@example/scoped', '2'],
        [
          'node_modules/@example/scoped/node_modules/fictional',
          'fictional',
          '1',
        ],
      ] as [string, string, string][]) {
        fs.mkdirSync(path.join(root, location), { recursive: true });
        fs.writeFileSync(
          path.join(root, location, 'package.json'),
          JSON.stringify({ name, version }),
        );
      }
      fs.mkdirSync(path.join(root, 'node_modules/.bin'));
      fs.writeFileSync(path.join(root, 'node_modules/README'), 'ignored');
      fs.writeFileSync(
        path.join(root, 'node_modules/.package-lock.json'),
        '{}',
      );
      const inventory = { packages: collectInstalledPackages(root) };
      assert.strictEqual(inventory.packages.length, 3);
      const output = renderProductionInventory(inventory);
      assert.match(output, /package paths \| 3/);
      assert.match(output, /name\/version pairs \| 2/);
      assert.match(output, /No previous-image comparison/);
      const script = path.resolve(
        __dirname,
        '../../../../../scripts/ci/production-dependencies.cts',
      );
      // These subprocesses test the executable's plain Node CLI modes. Avoid
      // inheriting NYC's ESM preload so each child does not load the coverage
      // instrumentation again while this synchronous test is running.
      const childEnv = { ...process.env, NODE_OPTIONS: '' };
      assert.deepStrictEqual(
        JSON.parse(
          execFileSync(process.execPath, [script], {
            cwd: root,
            encoding: 'utf8',
            env: childEnv,
          }),
        ),
        inventory,
      );
      assert.deepStrictEqual(
        JSON.parse(
          execFileSync(process.execPath, ['-', '--inventory-stdin'], {
            cwd: root,
            input: fs.readFileSync(script, 'utf8'),
            encoding: 'utf8',
            env: childEnv,
          }),
        ),
        inventory,
      );
      assert.deepStrictEqual(
        JSON.parse(
          execFileSync(
            process.execPath,
            ['--input-type=commonjs-typescript', '-', '--inventory-stdin'],
            {
              cwd: root,
              input: fs.readFileSync(script, 'utf8'),
              encoding: 'utf8',
              env: childEnv,
            },
          ),
        ),
        inventory,
      );
      assert.match(
        buildMarkdown([], {
          includeCoverage: false,
          lineChanges: summariseNumstat(''),
          productionInventory: inventory,
        }),
        /package paths \| 3/,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
