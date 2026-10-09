const assert = require('assert');
const { GROUPS, selectProjects } = require('../../../../../scripts/e2e/groups');
const {
  aggregateReports,
} = require('../../../../../scripts/e2e/aggregate-results');
const featureManifest = require('../../../../../tests/e2e/feature-coverage');

const EXPECTED_GROUPS = {
  'account-public': [
    'auth-smoke',
    'public',
    'authenticated',
    'photo-upload-firefox',
    'member',
  ],
  community: [
    'messages',
    'message-actions',
    'relationships-safety',
    'experiences',
    'messages-firefox-layout',
  ],
  'admin-search': [
    'admin',
    'search-offers-circles',
    'search-map-rendered',
    'search-map-wheel-firefox',
  ],
};

function passingTest(projectName, annotations = []) {
  return {
    projectName,
    annotations: annotations.map(([featureId, scenario]) => ({
      type: 'feature',
      description: `${featureId}::${scenario}`,
    })),
    results: [{ status: 'passed', duration: 1, annotations: [] }],
  };
}

function spec(title, testCase, overrides = {}) {
  return {
    file: 'tests/e2e/features/synthetic.spec.js',
    title,
    line: 1,
    column: 1,
    tests: [testCase],
    ...overrides,
  };
}

function suite(specs, title = 'synthetic suite') {
  return { title, specs, suites: [] };
}

function report(suites = [], errors = []) {
  return { suites, errors };
}

function passingEntry(reportValue) {
  return {
    status: { status: 'passed', exitCode: 0, message: 'passed' },
    report: reportValue,
  };
}

function completeEntries() {
  const entries = {};

  for (const group of Object.keys(GROUPS)) {
    const projectName = GROUPS[group][0];
    const specs = [];

    if (group === 'account-public') {
      let index = 0;
      for (const feature of featureManifest.features) {
        if (feature.status !== featureManifest.statuses.active) continue;

        for (const scenario of feature.requiredScenarios) {
          specs.push(
            spec(
              `manifest scenario ${index}`,
              passingTest(projectName, [[feature.id, scenario]]),
              { line: index + 1 },
            ),
          );
          index += 1;
        }
      }
    } else {
      specs.push(spec(`${group} product test`, passingTest(projectName)));
    }

    entries[group] = passingEntry(report([suite(specs, `${group} suite`)]));
  }

  return entries;
}

function ungroupedPlaywrightProjects() {
  const configuredGroup = process.env.TRUSTROOTS_E2E_GROUP;
  delete process.env.TRUSTROOTS_E2E_GROUP;
  const configPath = require.resolve('../../../../../playwright.config.cjs');
  delete require.cache[configPath];

  try {
    return require(configPath).projects;
  } finally {
    if (configuredGroup === undefined) {
      delete process.env.TRUSTROOTS_E2E_GROUP;
    } else {
      process.env.TRUSTROOTS_E2E_GROUP = configuredGroup;
    }
  }
}

function addSetupProjectResult(entry) {
  entry.report.suites.push(
    suite(
      [
        spec('authentication setup', passingTest('setup-authenticated'), {
          file: 'tests/e2e/setup/auth.setup.js',
        }),
      ],
      'authentication setup suite',
    ),
  );
}

describe('E2E group selection', () => {
  it('keeps the exact full-project membership for each group', () => {
    assert.deepStrictEqual(GROUPS, EXPECTED_GROUPS);
  });

  it('assigns every ungrouped Playwright project to exactly one group', () => {
    const actualNames = ungroupedPlaywrightProjects().map(
      project => project.name,
    );
    const groupedNames = [
      'setup-authenticated',
      ...Object.values(GROUPS).flat(),
    ];

    assert.strictEqual(
      new Set(groupedNames).size,
      groupedNames.length,
      'groups should not assign a project more than once',
    );
    assert.strictEqual(
      new Set(actualNames).size,
      actualNames.length,
      'the ungrouped Playwright config should not repeat project names',
    );
    assert.deepStrictEqual([...groupedNames].sort(), [...actualNames].sort());
  });

  it('keeps only group-local dependencies and starts each group at setup', () => {
    const projects = [
      { name: 'setup-authenticated', dependencies: ['outside'] },
      { name: 'auth-smoke', dependencies: ['setup-authenticated', 'public'] },
      { name: 'public', dependencies: ['setup-authenticated', 'admin'] },
      { name: 'authenticated', dependencies: ['public'] },
      { name: 'photo-upload-firefox', dependencies: ['authenticated'] },
      { name: 'member', dependencies: ['setup-authenticated', 'admin'] },
      { name: 'community-extra', dependencies: [] },
    ];

    const selected = selectProjects(projects, 'account-public', false);

    assert.deepStrictEqual(
      selected.map(project => [project.name, project.dependencies]),
      [
        ['setup-authenticated', []],
        ['auth-smoke', ['setup-authenticated', 'public']],
        ['public', ['setup-authenticated']],
        ['authenticated', ['public']],
        ['photo-upload-firefox', ['authenticated']],
        ['member', ['setup-authenticated']],
      ],
    );
    assert.strictEqual(selected[1].name, 'auth-smoke');
  });

  it('serialises dependencies inside the selected group only', () => {
    const projects = [
      { name: 'setup-authenticated', dependencies: [] },
      { name: 'messages', dependencies: ['setup-authenticated'] },
      { name: 'message-actions', dependencies: ['messages', 'admin'] },
      { name: 'relationships-safety', dependencies: ['message-actions'] },
      { name: 'experiences', dependencies: ['relationships-safety'] },
      { name: 'messages-firefox-layout', dependencies: ['experiences'] },
    ];

    const selected = selectProjects(projects, 'community', true);

    assert.deepStrictEqual(
      selected.map(project => [project.name, project.dependencies]),
      [
        ['setup-authenticated', []],
        ['messages', ['setup-authenticated']],
        ['message-actions', ['messages']],
        ['relationships-safety', ['message-actions']],
        ['experiences', ['relationships-safety']],
        ['messages-firefox-layout', ['experiences']],
      ],
    );
  });

  it('returns the original project list unchanged when no group is selected', () => {
    const projects = [
      { name: 'setup-authenticated', dependencies: ['other'] },
      { name: 'auth-smoke', dependencies: ['setup-authenticated'] },
    ];

    const selected = selectProjects(projects, undefined, true);

    assert.strictEqual(selected, projects);
    assert.deepStrictEqual(selected, projects);
  });

  it('rejects an unknown group name', () => {
    assert.throws(
      () => selectProjects([], 'unknown', false),
      /Unknown e2e group: unknown/,
    );
  });
});

describe('E2E report aggregation', () => {
  it('passes complete reports whose annotations cover every active manifest scenario', () => {
    const result = aggregateReports(completeEntries());

    assert.strictEqual(result.status.status, 'passed');
    assert.strictEqual(result.status.exitCode, 0);
    assert.strictEqual(result.status.metrics.missingScenarioCount, 0);
    assert.strictEqual(
      result.status.metrics.coveredScenarioCount,
      result.status.metrics.requiredScenarioCount,
    );
    assert.strictEqual(result.report.suites.length, 3);
  });

  it('fails when a group status reports failure', () => {
    const entries = completeEntries();
    entries.community.status = {
      status: 'failed',
      exitCode: 1,
      message: 'community failed',
    };

    const result = aggregateReports(entries);

    assert.strictEqual(result.status.status, 'failed');
    assert.strictEqual(result.status.exitCode, 1);
    assert.match(result.status.message, /community: community failed/);
  });

  it('fails when a final Playwright result failed or was skipped', () => {
    for (const status of ['failed', 'skipped', 'timedOut', 'interrupted']) {
      const entries = completeEntries();
      entries.community.report.suites[0].specs[0].tests[0].results[0].status =
        status;

      const result = aggregateReports(entries);

      assert.strictEqual(result.status.status, 'failed', `${status} result`);
      assert.strictEqual(result.status.exitCode, 1, `${status} result`);
      assert.match(
        result.status.message,
        /Some tests failed, were skipped or could not run\./,
      );
    }
  });

  it('fails for missing status or report entries', () => {
    for (const badEntry of [
      null,
      { status: { status: 'passed', exitCode: 0 } },
    ]) {
      const entries = completeEntries();
      entries.community = badEntry;

      const result = aggregateReports(entries);

      assert.strictEqual(result.status.status, 'failed');
      assert.match(
        result.status.message,
        /community: missing status or results/,
      );
    }
  });

  it('fails for malformed status and report data', () => {
    const badStatus = completeEntries();
    badStatus.community.status = { status: 'passed', exitCode: '0' };
    assert.match(
      aggregateReports(badStatus).status.message,
      /community: group failed/,
    );

    const badReport = completeEntries();
    badReport.community.report = { suites: [], errors: 'none' };
    assert.match(
      aggregateReports(badReport).status.message,
      /community: malformed results/,
    );

    const malformedSuite = completeEntries();
    malformedSuite.community.report = report([
      { title: 'bad suite', suites: [] },
    ]);
    assert.match(
      aggregateReports(malformedSuite).status.message,
      /community: malformed suite/,
    );
  });

  it('accepts Playwright leaf suites that omit the nested suites array', () => {
    const entries = completeEntries();
    for (const entry of Object.values(entries)) {
      for (const suiteRecord of entry.report.suites) {
        delete suiteRecord.suites;
      }
    }

    const result = aggregateReports(entries);

    assert.strictEqual(result.status.status, 'passed');
    assert.strictEqual(result.status.metrics.missingScenarioCount, 0);
  });

  it('fails when the aggregate CI job result reports failure', () => {
    const result = aggregateReports(completeEntries(), 'failure');

    assert.strictEqual(result.status.status, 'failed');
    assert.strictEqual(result.status.exitCode, 1);
    assert.match(
      result.status.message,
      /E2E group jobs did not succeed: failure\./,
    );
  });

  it('fails when a product record is duplicated within a group', () => {
    const entries = completeEntries();
    const existing = entries.community.report.suites[0].specs[0];
    entries.community.report.suites[0].specs.push({
      ...existing,
      tests: [passingTest('messages')],
    });

    const result = aggregateReports(entries);

    assert.strictEqual(result.status.status, 'failed');
    assert.match(result.status.message, /community: duplicate product test/);
  });

  it('fails when a report contains a project outside its group', () => {
    const entries = completeEntries();
    entries.community.report.suites[0].specs.push(
      spec('unexpected project case', passingTest('admin')),
    );

    const result = aggregateReports(entries);

    assert.strictEqual(result.status.status, 'failed');
    assert.match(result.status.message, /community: unexpected project admin/);
  });

  it('fails when a report has no product tests', () => {
    for (const emptyReport of [
      report(),
      report([
        suite([
          spec('setup-only report', passingTest('setup-authenticated'), {
            file: 'tests/e2e/setup/auth.setup.js',
          }),
        ]),
      ]),
    ]) {
      const entries = completeEntries();
      entries.community.report = emptyReport;

      const result = aggregateReports(entries);

      assert.strictEqual(result.status.status, 'failed');
      assert.match(result.status.message, /community: no product tests/);
    }
  });

  it('accepts repeated authentication setup records across group reports', () => {
    const entries = completeEntries();
    for (const group of Object.keys(GROUPS)) {
      addSetupProjectResult(entries[group]);
    }

    const result = aggregateReports(entries);
    const setupRecords = result.report.suites.flatMap(
      groupSuite => groupSuite.specs,
    );

    assert.strictEqual(result.status.status, 'passed');
    assert.strictEqual(
      setupRecords.filter(specRecord =>
        specRecord.file.endsWith('/auth.setup.js'),
      ).length,
      Object.keys(GROUPS).length,
    );
  });

  it('fails when feature annotations leave any required scenario uncovered', () => {
    const entries = completeEntries();
    const firstSpec = entries['account-public'].report.suites[0].specs[0];
    firstSpec.tests[0].annotations = [];

    const result = aggregateReports(entries);

    assert.strictEqual(result.status.status, 'failed');
    assert.strictEqual(result.status.exitCode, 1);
    assert.match(result.status.message, /Incomplete feature coverage:/);
  });

  it('fails when any group report has runner-level errors', () => {
    const entries = completeEntries();
    entries['admin-search'].report.errors.push({ message: 'runner error' });

    const result = aggregateReports(entries);

    assert.strictEqual(result.status.status, 'failed');
    assert.strictEqual(result.report.errors.length, 1);
    assert.match(
      result.status.message,
      /Some tests failed, were skipped or could not run\./,
    );
  });
});
