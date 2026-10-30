const assert: typeof import('node:assert') = require('assert');
const { spawnSync } = require('child_process');
const fs: typeof import('node:fs') = require('fs');
const os = require('os');
const path: typeof import('node:path') = require('path');
require('should');

const should: typeof import('should') = require('should');
void should;
const {
  AREA_BY_SPEC,
  DEFINED_AREAS,
  areaForSpec,
  computeAreaCoverage,
} = require('../../../../../scripts/e2e/areas');
const {
  annotateFeature,
  featureAnnotation,
  parseFeatureAnnotation,
  summarizeFeatureCoverage,
  validateFeatureManifest,
} = require('../../../../../scripts/e2e/feature-coverage-summary');
const {
  featureCoverageIncomplete,
  summarizeReport,
} = require('../../../../../scripts/e2e/summarize-results');
const {
  buildE2eMetrics,
  resolveE2eLaneMessage,
  resolveE2eLaneStatus,
} = require('../../../../../scripts/coverage/generate-report.cts');

type TestAnnotation = { type: string; description?: string };
type TestCase = {
  annotations: TestAnnotation[];
  results: Array<{ status: string; annotations: TestAnnotation[] }>;
};
type TestSpec = {
  file: string;
  title: string;
  annotations?: TestAnnotation[];
  tests: TestCase[];
};

function reportWithSpecs(specs: TestSpec[]) {
  return {
    suites: [
      {
        specs,
        suites: [],
      },
    ],
  };
}

function testCase(
  status: string,
  annotations: TestAnnotation[] = [],
): TestCase {
  return {
    annotations,
    results: [{ status, annotations: [] }],
  };
}

function spec(file: string, title: string, tests: TestCase[]): TestSpec {
  return {
    file,
    title,
    annotations: [],
    tests,
  };
}

function manifest(features: unknown[]) {
  return {
    statuses: {
      active: 'active',
      excluded: 'excluded',
    },
    areas: {
      messages: 'messages',
      publicCore: 'public-core',
    },
    roleDefinitions: {
      member: 'Member',
      visitor: 'Visitor',
    },
    features,
  };
}

describe('E2E coverage reporter unit tests', () => {
  describe('areaForSpec', () => {
    function featureSpecFiles(
      dir = path.resolve('tests/e2e/features'),
    ): string[] {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const entryPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          return featureSpecFiles(entryPath);
        }

        return entry.name.endsWith('.spec.js') ? [entryPath] : [];
      });
    }

    it('maps every current feature spec to a named area', () => {
      const unmappedSpecs = featureSpecFiles().filter(
        (specPath: string) => !AREA_BY_SPEC[path.basename(specPath)],
      );

      unmappedSpecs.should.deepEqual([]);
    });

    it('maps rendered search map specs to a defined area', () => {
      areaForSpec(
        '/repo/tests/e2e/features/search-offers-circles/search-map-rendered.spec.js',
      ).should.equal('Member flows');
    });

    it('maps signup and support limit specs to Authentication', () => {
      areaForSpec(
        '/repo/tests/e2e/features/auth-account/signup-and-support-limits.spec.js',
      ).should.equal('Authentication');
    });

    it('maps missing or unknown specs to Other', () => {
      areaForSpec().should.equal('Other');
      areaForSpec('tests/e2e/features/custom/new-flow.spec.js').should.equal(
        'Other',
      );
    });
  });

  describe('computeAreaCoverage', () => {
    it('counts exercised and green areas separately', () => {
      const summary = computeAreaCoverage({
        Authentication: { total: 2, passed: 2, failed: 0, skipped: 0 },
        Messages: { total: 1, passed: 0, failed: 1, skipped: 0 },
        Other: { total: 1, passed: 1, failed: 0, skipped: 0 },
      });

      summary.defined.should.equal(DEFINED_AREAS.length);
      summary.exercised.should.equal(2);
      summary.green.should.equal(1);
      summary.areaCoverage.should.equal(
        Number(((2 / DEFINED_AREAS.length) * 100).toFixed(2)),
      );
      summary.areaPassCoverage.should.equal(
        Number(((1 / DEFINED_AREAS.length) * 100).toFixed(2)),
      );
    });
  });

  describe('summarizeReport', () => {
    it('counts setup checks without assigning them to a product area', () => {
      const summary = summarizeReport(
        reportWithSpecs([
          spec('tests/e2e/setup/auth.setup.js', 'authentication setup', [
            testCase('passed'),
            testCase('passed'),
            testCase('passed'),
          ]),
          spec('tests/e2e/features/messages/messages.spec.js', 'inbox', [
            testCase('passed'),
          ]),
        ]),
      );

      summary.total.should.equal(4);
      summary.passed.should.equal(4);
      summary.byArea.should.deepEqual({
        Messages: { total: 1, passed: 1, failed: 0, skipped: 0 },
      });
      summary.areas.should.deepEqual(['Messages']);
    });
  });

  describe('feature annotations', () => {
    it('creates and parses feature-only annotations', () => {
      const annotation = featureAnnotation('messages.inbox');

      annotation.should.deepEqual({
        type: 'feature',
        description: 'messages.inbox',
      });
      parseFeatureAnnotation(annotation).should.deepEqual({
        featureId: 'messages.inbox',
        scenario: null,
      });
    });

    it('creates and parses scenario-level annotations', () => {
      const annotation = featureAnnotation(
        'messages.inbox',
        'Inbox lists seeded conversation.',
      );

      parseFeatureAnnotation(annotation).should.deepEqual({
        featureId: 'messages.inbox',
        scenario: 'Inbox lists seeded conversation.',
      });
    });

    it('ignores unrelated or empty annotations', () => {
      assert.strictEqual(parseFeatureAnnotation({ type: 'slow' }), null);
      assert.strictEqual(
        parseFeatureAnnotation({ type: 'feature', description: ' ' }),
        null,
      );
    });

    it('adds multiple scenario annotations to Playwright testInfo', () => {
      const testInfo = { annotations: [] };

      annotateFeature(testInfo, 'messages.read-count-sync', [
        'Unread count changes after opening or marking a thread read.',
        'Message sync endpoint returns deterministic updates.',
      ]);

      testInfo.annotations.map(parseFeatureAnnotation).should.deepEqual([
        {
          featureId: 'messages.read-count-sync',
          scenario:
            'Unread count changes after opening or marking a thread read.',
        },
        {
          featureId: 'messages.read-count-sync',
          scenario: 'Message sync endpoint returns deterministic updates.',
        },
      ]);
    });
  });

  describe('validateFeatureManifest', () => {
    it('accepts a minimal valid active feature', () => {
      validateFeatureManifest(
        manifest([
          {
            id: 'messages.inbox',
            area: 'messages',
            status: 'active',
            roles: ['member'],
            requiredScenarios: ['Inbox lists seeded conversation.'],
            relatedSpecs: [],
          },
        ]),
      ).should.deepEqual([]);
    });

    it('reports invalid active feature definitions', () => {
      const errors = validateFeatureManifest(
        manifest([
          {
            id: 'messages.inbox',
            area: 'unknown-area',
            status: 'active',
            roles: ['missing-role'],
            requiredScenarios: [],
            relatedSpecs: [{}],
          },
          {
            id: 'messages.inbox',
            area: 'messages',
            status: 'active',
            roles: ['member'],
            requiredScenarios: ['Duplicate id scenario.'],
            relatedSpecs: [],
          },
        ]),
      );

      errors.should.containEql('Feature id "messages.inbox" is duplicated.');
      errors.should.containEql(
        'Feature "messages.inbox" has invalid area "unknown-area".',
      );
      errors.should.containEql(
        'Feature "messages.inbox" has unknown role "missing-role".',
      );
      errors.should.containEql(
        'Active feature "messages.inbox" has no required scenarios.',
      );
      errors.should.containEql(
        'Feature "messages.inbox" has a relatedSpec without file/title.',
      );
    });
  });

  describe('summarizeFeatureCoverage', () => {
    it('counts passed scenario annotations as covered feature scenarios', () => {
      const featureManifest = manifest([
        {
          id: 'messages.inbox',
          area: 'messages',
          status: 'active',
          roles: ['member'],
          requiredScenarios: [
            'Inbox lists seeded conversation.',
            'Inbox excludes shadow-hidden conversations.',
          ],
          relatedSpecs: [],
        },
      ]);
      const report = reportWithSpecs([
        spec('tests/e2e/features/messages/messages.spec.js', 'inbox', [
          testCase('passed', [
            featureAnnotation(
              'messages.inbox',
              'Inbox lists seeded conversation.',
            ),
            featureAnnotation(
              'messages.inbox',
              'Inbox excludes shadow-hidden conversations.',
            ),
          ]),
        ]),
      ]);

      const summary = summarizeFeatureCoverage(report, featureManifest);

      summary.coveredFeatureCount.should.equal(1);
      summary.greenFeatureCount.should.equal(1);
      summary.coveredScenarioCount.should.equal(2);
      summary.missingScenarioCount.should.equal(0);
      summary.featureCoverage.should.equal(100);
      summary.scenarioCoverage.should.equal(100);
    });

    it('keeps related specs as touch evidence without covering scenarios', () => {
      const featureManifest = manifest([
        {
          id: 'messages.inbox',
          area: 'messages',
          status: 'active',
          roles: ['member'],
          requiredScenarios: ['Inbox lists seeded conversation.'],
          relatedSpecs: [
            {
              file: 'tests/e2e/features/messages/messages.spec.js',
              title: 'inbox lists the seeded conversation with Portland Host',
            },
          ],
        },
      ]);
      const report = reportWithSpecs([
        spec(
          'tests/e2e/features/messages/messages.spec.js',
          'inbox lists the seeded conversation with Portland Host',
          [testCase('passed')],
        ),
      ]);

      const summary = summarizeFeatureCoverage(report, featureManifest);

      summary.touchedFeatureCount.should.equal(1);
      summary.coveredFeatureCount.should.equal(0);
      summary.missingByArea.messages[0].relatedPassingSpecs.should.deepEqual([
        {
          file: 'tests/e2e/features/messages/messages.spec.js',
          title: 'inbox lists the seeded conversation with Portland Host',
        },
      ]);
    });

    it('marks covered features as not green when annotated tests fail', () => {
      const featureManifest = manifest([
        {
          id: 'messages.inbox',
          area: 'messages',
          status: 'active',
          roles: ['member'],
          requiredScenarios: ['Inbox lists seeded conversation.'],
          relatedSpecs: [],
        },
      ]);
      const report = reportWithSpecs([
        spec('tests/e2e/features/messages/messages.spec.js', 'inbox', [
          testCase('passed', [
            featureAnnotation(
              'messages.inbox',
              'Inbox lists seeded conversation.',
            ),
          ]),
          testCase('failed', [
            featureAnnotation(
              'messages.inbox',
              'Inbox lists seeded conversation.',
            ),
          ]),
        ]),
      ]);

      const summary = summarizeFeatureCoverage(report, featureManifest);

      summary.coveredFeatureCount.should.equal(1);
      summary.greenFeatureCount.should.equal(0);
      summary.features[0].green.should.equal(false);
    });
  });

  describe('summarize-results status output', () => {
    it('honors TRUSTROOTS_E2E_STATUS_PATH for isolated status writes', () => {
      const statusPath = path.join(
        os.tmpdir(),
        `trustroots-e2e-status-${process.pid}-${Date.now()}.json`,
      );
      const missingResultsPath = path.join(
        os.tmpdir(),
        `trustroots-e2e-results-missing-${process.pid}-${Date.now()}.json`,
      );

      const result = spawnSync(
        process.execPath,
        ['scripts/e2e/summarize-results.js'],
        {
          cwd: path.resolve(__dirname, '../../../../../'),
          env: {
            ...process.env,
            STATUS: 'passed',
            EXIT_CODE: '0',
            MESSAGE: 'isolated status path test',
            TRUSTROOTS_E2E_STATUS_PATH: statusPath,
            TRUSTROOTS_E2E_COVERAGE_DIR: `${statusPath}.coverage`,
            TRUSTROOTS_E2E_RESULTS_PATH: missingResultsPath,
          },
          encoding: 'utf8',
        },
      );

      result.status.should.equal(0);
      fs.existsSync(statusPath).should.equal(true);
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      status.status.should.equal('passed');
      status.exitCode.should.equal(0);

      fs.unlinkSync(statusPath);
    });

    it('marks incomplete feature coverage as failed', () => {
      featureCoverageIncomplete({
        missingScenarioCount: 1,
        featurePassCoverage: 98.98,
      }).should.equal(true);
      featureCoverageIncomplete({
        missingScenarioCount: 0,
        featurePassCoverage: 100,
      }).should.equal(false);
    });

    it('fails status output when required feature scenarios are missing', () => {
      const statusPath = path.join(
        os.tmpdir(),
        `trustroots-e2e-status-${process.pid}-${Date.now()}.json`,
      );
      const resultsPath = path.join(
        os.tmpdir(),
        `trustroots-e2e-results-${process.pid}-${Date.now()}.json`,
      );

      const report = reportWithSpecs([
        {
          file: 'tests/e2e/features/messages/messages.spec.js',
          title: 'inbox lists seeded conversation',
          tests: [
            testCase('passed', [
              featureAnnotation(
                'messages.inbox',
                'Inbox lists seeded conversation.',
              ),
            ]),
          ],
        },
      ]);
      fs.writeFileSync(resultsPath, `${JSON.stringify(report)}\n`);

      const result = spawnSync(
        process.execPath,
        ['scripts/e2e/summarize-results.js'],
        {
          cwd: path.resolve(__dirname, '../../../../../'),
          env: {
            ...process.env,
            STATUS: 'passed',
            EXIT_CODE: '0',
            MESSAGE: 'End-to-end Playwright tests passed.',
            TRUSTROOTS_E2E_STATUS_PATH: statusPath,
            TRUSTROOTS_E2E_COVERAGE_DIR: `${statusPath}.coverage`,
            TRUSTROOTS_E2E_RESULTS_PATH: resultsPath,
          },
          encoding: 'utf8',
        },
      );

      result.status.should.equal(1);
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      status.status.should.equal('failed');
      status.exitCode.should.equal(1);
      status.message.should.match(/feature scenarios missing/);
      status.metrics.missingScenarioCount.should.be.above(0);

      fs.unlinkSync(statusPath);
      fs.unlinkSync(resultsPath);
    });
    for (const [testStatus, testExitCode] of [
      ['passed', '0'],
      ['failed', '1'],
    ]) {
      it(`preserves ${testStatus} results for deliberately partial screenshot runs`, () => {
        const directory = fs.mkdtempSync(
          path.join(os.tmpdir(), 'trustroots-e2e-partial-'),
        );
        const resultsPath = path.join(directory, 'results.json');
        const statusPath = path.join(directory, 'status.json');
        const coverageDirectory = path.join(directory, 'coverage');
        const report = reportWithSpecs([
          {
            file: 'tests/e2e/features/messages/messages.spec.js',
            title: 'inbox lists seeded conversation',
            tests: [testCase(testStatus)],
          },
        ]);
        try {
          fs.writeFileSync(resultsPath, JSON.stringify(report));
          fs.mkdirSync(coverageDirectory);
          fs.writeFileSync(
            path.join(coverageDirectory, 'coverage-summary.json'),
            JSON.stringify({
              total: {
                statements: { pct: 25 },
                branches: { pct: 50 },
                functions: { pct: 75 },
                lines: { pct: 100 },
              },
            }),
          );
          const result = spawnSync(
            process.execPath,
            ['scripts/e2e/summarize-results.js'],
            {
              cwd: path.resolve(__dirname, '../../../../../'),
              env: {
                ...process.env,
                STATUS: testStatus,
                EXIT_CODE: testExitCode,
                TRUSTROOTS_E2E_REQUIRE_FULL_FEATURE_COVERAGE: 'false',
                TRUSTROOTS_E2E_STATUS_PATH: statusPath,
                TRUSTROOTS_E2E_COVERAGE_DIR: coverageDirectory,
                TRUSTROOTS_E2E_RESULTS_PATH: resultsPath,
              },
              encoding: 'utf8',
            },
          );
          result.status.should.equal(0);
          const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
          status.status.should.equal(testStatus);
          status.exitCode.should.equal(Number(testExitCode));
          status.metrics.failed.should.equal(testStatus === 'failed' ? 1 : 0);
          status.metrics.missingScenarioCount.should.be.above(0);
          status.metrics.codeCoverage.should.deepEqual({
            statements: 25,
            branches: 50,
            functions: 75,
            lines: 100,
          });
        } finally {
          fs.rmSync(directory, { recursive: true, force: true });
        }
      });
    }
  });

  describe('coverage report e2e lane status', () => {
    it('does not keep a passed lane when feature coverage is incomplete', () => {
      const metrics = buildE2eMetrics(
        {
          total: 174,
          passed: 174,
          failed: 0,
          passRate: 100,
          durationMs: 1000,
          areaCoverage: 100,
          areaPassCoverage: 100,
          featureCoverage: 98.98,
          featurePassCoverage: 98.98,
          scenarioCoverage: 99.6,
          definedAreaCount: 8,
          exercisedAreaCount: 8,
          greenAreaCount: 8,
          activeFeatureCount: 98,
          coveredFeatureCount: 97,
          missingFeatureCount: 1,
          requiredScenarioCount: 247,
          coveredScenarioCount: 246,
          missingScenarioCount: 1,
        },
        {
          tests: 46,
          passRate: 100,
          areaCoverage: 0,
          areaPassCoverage: 0,
          featureCoverage: 100,
          featurePassCoverage: 100,
          scenarioCoverage: 100,
        },
      );

      metrics.passed.should.equal(false);
      resolveE2eLaneStatus('passed', metrics).should.equal('failed');
      resolveE2eLaneMessage(
        'passed',
        metrics,
        'Playwright passed.',
      ).should.match(/feature coverage is below 100%/);
    });
  });
});

describe('raw E2E coverage summary', () => {
  it('summarises file coverage before combining its totals', () => {
    const { createCoverageMap } = require('istanbul-lib-coverage');
    const {
      summarizeMap,
    } = require('../../../../../scripts/e2e/merge-js-coverage');
    const location = {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 1 },
    };
    const map = createCoverageMap({
      '/anonymous/function.ts': {
        path: '/anonymous/function.ts',
        statementMap: { 0: location },
        fnMap: {
          0: { name: 'handler', decl: location, loc: location, line: 1 },
        },
        branchMap: {
          0: {
            type: 'if',
            loc: location,
            locations: [location, location],
            line: 1,
          },
        },
        s: { 0: 1 },
        f: { 0: 1 },
        b: { 0: [1, 0] },
      },
    });
    const { total } = summarizeMap(map);
    assert.strictEqual(total.statements.pct, 100);
    assert.strictEqual(total.functions.pct, 100);
    assert.strictEqual(total.lines.pct, 100);
    assert.strictEqual(total.branches.pct, 50);
  });
});
