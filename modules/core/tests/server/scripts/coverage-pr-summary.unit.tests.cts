const fs: typeof import('node:fs') = require('fs');
const os: typeof import('node:os') = require('os');
const path: typeof import('node:path') = require('path');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {
  execFileSync,
}: typeof import('node:child_process') = require('node:child_process');
require('should');

const {
  areaLabel,
  buildMarkdown,
  formatDate,
  formatDuration,
  marker,
  readLanes,
  renderE2eAreaTable,
  renderOverviewTable,
} = require('../../../../../scripts/coverage/generate-pr-summary.cts');

describe('Coverage PR summary unit tests', () => {
  const clientLane = {
    name: 'client',
    label: 'Client',
    kind: 'coverage',
    status: 'passed',
    generatedAt: '2026-07-03T19:29:00.000Z',
    artifactName: 'coverage-client',
    durationMs: 83000,
    metrics: {
      statements: { current: 100 },
      branches: { current: 99.95 },
      functions: { current: 100 },
      lines: { current: 100 },
    },
  };
  const e2eLane = {
    name: 'e2e',
    label: 'End-to-end',
    kind: 'test',
    status: 'passed',
    generatedAt: '2026-07-03T19:23:00.000Z',
    artifactName: 'playwright-report',
    e2eMetrics: {
      testValues: {
        total: { current: 136 },
        passed: { current: 136 },
        passRate: { current: 100 },
      },
      featureValues: {
        featureCoverage: { current: 100 },
        scenarioCoverage: { current: 100 },
      },
      durationMs: 252000,
      byArea: {
        Messages: { total: 6, passed: 6, failed: 0, skipped: 0 },
        Other: { total: 1, passed: 1, failed: 0, skipped: 0 },
      },
      definedAreaCount: 8,
      greenAreaCount: 7,
      activeFeatureCount: 97,
      coveredFeatureCount: 97,
      requiredScenarioCount: 236,
      coveredScenarioCount: 236,
    },
  };

  describe('formatting helpers', () => {
    it('formats UTC dates and durations for markdown', () => {
      formatDate('2026-07-03T19:29:00.000Z').should.equal(
        '2026-07-03 19:29 UTC',
      );
      formatDuration(252000).should.equal('4m 12s');
    });

    it('labels Other as unmapped specs', () => {
      areaLabel('Other').should.equal('Other (unmapped specs)');
      areaLabel('Messages').should.equal('Messages');
    });
  });

  describe('readLanes', () => {
    it('reads available lane JSON files in suite order', () => {
      const dir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'trustroots-pr-summary-'),
      );
      try {
        fs.writeFileSync(
          path.join(dir, 'e2e.json'),
          `${JSON.stringify(e2eLane)}\n`,
        );
        fs.writeFileSync(
          path.join(dir, 'client.json'),
          `${JSON.stringify(clientLane)}\n`,
        );

        readLanes(dir)
          .map((lane: { name: string }) => lane.name)
          .should.deepEqual(['client', 'e2e']);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('renderOverviewTable', () => {
    it('renders coverage and end-to-end lanes', () => {
      const table = renderOverviewTable([clientLane, e2eLane]);

      table.should.containEql('<table>');
      table.should.containEql('<th>Result</th>');
      table.should.containEql('<td>Client</td>');
      table.should.containEql('<td>✅ Passed</td>');
      table.should.containEql('2026-07-03 19:29 UTC<br>Duration 1m 23s');
      table.should.containEql(
        '<pre>Statements  🟢 100.00%\nBranches    🟡 99.95%',
      );
      table.should.containEql(
        'Functions   🟢 100.00%\nLines       🟢 100.00%</pre>',
      );
      table.should.containEql(
        '<pre>Tests              🟢 136/136\nPass rate          🟢 100.00%',
      );
      table.should.containEql('Areas              🟡 7/8');
      table.should.containEql('Features           🟢 97/97');
      table.should.containEql('Scenario coverage  🟢 100.00%</pre>');
      table.should.containEql('2026-07-03 19:23 UTC<br>Duration 4m 12s');
      table.should.containEql('<code>coverage-client</code>');
    });
  });

  describe('renderE2eAreaTable', () => {
    it('renders mapped areas and unmapped specs', () => {
      const table = renderE2eAreaTable(e2eLane);

      table.should.containEql('| Messages | ✅ Passed | 6 | 0 | 6 |');
      table.should.containEql(
        '| Other (unmapped specs) | ✅ Passed | 1 | 0 | 1 |',
      );
      table.should.containEql('| **Total** |  | **7** | **0** | **7** |');
    });
  });

  describe('buildMarkdown', () => {
    it('hides the visible coverage table only when every recorded suite passed', () => {
      const passing = buildMarkdown([clientLane, e2eLane]);
      const visible = passing.slice(0, passing.indexOf('<details>'));
      assert.match(visible, /Coverage status: \*\*✅ Passed\*\*/);
      assert.doesNotMatch(visible, /<table>/);
      assert.match(passing.slice(passing.indexOf('<details>')), /<table>/);
      for (const status of ['failed', 'blocked', 'skipped', 'unknown']) {
        const output = buildMarkdown([clientLane, { ...e2eLane, status }]);
        assert.match(output.slice(0, output.indexOf('<details>')), /<table>/);
      }
      assert.doesNotMatch(
        buildMarkdown([]),
        /Coverage status: \*\*✅ Passed\*\*/,
      );
    });
    it('keeps sections ordered and refreshes changes without breaking folded details', () => {
      const {
        summariseNumstat,
        updateLineChangesComment,
      } = require('../../../../../scripts/coverage/line-changes.cts');
      const {
        summariseDependencies,
      } = require('../../../../../scripts/coverage/dependency-changes.cts');
      const lineChanges = {
        ...summariseNumstat('2\t0\tREADME.md\0'),
        dependencies: summariseDependencies(
          { manifest: {}, lock: {} },
          { manifest: { dependencies: { fictional: '1' } }, lock: {} },
        ),
      };
      const markdown = buildMarkdown([clientLane, e2eLane], {
        lineChanges,
        productionInventory: { packages: [] },
      });
      const headings = [
        'Tests and coverage',
        'Line changes',
        'Dependencies',
        'CI timings',
        'Reports',
      ];
      const positions = headings.map(heading =>
        markdown.search(new RegExp(`(?:### |<h3>)${heading}`)),
      );
      assert.ok(
        positions.every(
          (position, index) =>
            position >= 0 && (!index || position > positions[index - 1]),
        ),
      );
      const refreshed = updateLineChangesComment(
        updateLineChangesComment(markdown, lineChanges),
        lineChanges,
      );
      assert.equal(refreshed, markdown);
      assert.equal(
        (refreshed.match(/<details>/g) || []).length,
        (refreshed.match(/<\/details>/g) || []).length,
      );
      assert.equal((refreshed.match(/### Dependencies/g) || []).length, 1);
      assert.match(
        refreshed,
        /<summary>Production image dependencies<\/summary>/,
      );
      assert.match(refreshed, /<summary>End-to-end areas<\/summary>/);
    });

    it('keeps problems visible outside disclosures and escapes diagnostic text', () => {
      for (const status of ['failed', 'blocked', 'skipped', 'unknown']) {
        const markdown = buildMarkdown([
          { ...clientLane, status, message: 'Example <failure> & details' },
        ]);
        const visible = markdown.slice(0, markdown.indexOf('<details>'));
        assert.match(visible, /Example &lt;failure&gt; &amp; details/);
        assert.ok(
          visible.includes(status.charAt(0).toUpperCase() + status.slice(1)),
        );
      }
      assert.match(buildMarkdown([]), /Coverage status: \*\*Unavailable\*\*/);
      const missing = renderOverviewTable(
        [{ name: 'e2e', kind: 'test' }],
        true,
      );
      assert.match(missing, /Metrics unavailable/);
      const docs = buildMarkdown([], { includeCoverage: false });
      assert.match(docs, /Coverage was not requested/);
      assert.doesNotMatch(docs, /Coverage status: \*\*Passing/);
      assert.match(docs, /Installed inventory unavailable/);
    });

    it('runs reporting and full coverage enforcement without installed dependencies', () => {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'fictional-reports-'),
      );
      try {
        fs.cpSync(
          path.resolve(__dirname, '../../../../../scripts/coverage'),
          path.join(directory, 'scripts/coverage'),
          { recursive: true },
        );
        fs.cpSync(
          path.resolve(__dirname, '../../../../../docs/_data'),
          path.join(directory, 'docs/_data'),
          { recursive: true },
        );
        fs.cpSync(
          path.resolve(__dirname, '../../../../../tooling/baselines'),
          path.join(directory, 'tooling/baselines'),
          { recursive: true },
        );
        for (const suite of ['client', 'server']) {
          const dir = path.join(directory, 'coverage', suite);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(
            path.join(dir, 'coverage-summary.json'),
            JSON.stringify({
              total: Object.fromEntries(
                ['statements', 'branches', 'functions', 'lines'].map(metric => [
                  metric,
                  { pct: 100 },
                ]),
              ),
            }),
          );
        }
        const run = (script: string, ...args: string[]) =>
          execFileSync(
            process.execPath,
            [
              path.join(directory, 'scripts/coverage', `${script}.cts`),
              ...args,
            ],
            {
              cwd: directory,
              encoding: 'utf8',
              env: {
                ...process.env,
                // Exercise the dependency-free CI path without preloading the
                // application's instrumenter into each reporting process.
                NODE_OPTIONS: '',
                NODE_PATH: '',
                PR_BASE_SHA: '',
                PR_HEAD_SHA: '',
              },
            },
          );
        run('generate-report');
        const markdown = run('generate-pr-summary');
        assert.ok(markdown.startsWith(`${marker}\n## Pull request overview`));
        assert.doesNotMatch(
          markdown,
          /Unsupported engine|Already up to date|Done in/,
        );
        assert.ok(
          fs.existsSync(path.join(directory, 'coverage-report/index.html')),
        );
        run('check-coverage', '--require-full');
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it('renders a sticky-comment friendly markdown summary', () => {
      const markdown = buildMarkdown([clientLane, e2eLane], {
        runUrl: 'https://github.com/Trustroots/trustroots/actions/runs/1',
      });

      markdown.should.startWith(marker);
      markdown.should.containEql('## Pull request overview');
      markdown.should.containEql('Coverage status: **✅ Passed**');
      markdown.should.containEql('[this workflow run]');
      markdown.should.containEql('coverage-report');
    });

    it('marks blocked lanes as needing attention', () => {
      const markdown = buildMarkdown([
        clientLane,
        {
          ...e2eLane,
          status: 'blocked',
          message: 'End-to-end tests blocked by network permission.',
        },
      ]);

      markdown.should.containEql('Coverage status: **Needs attention**');
    });

    it('marks failed feature coverage as needing attention', () => {
      const markdown = buildMarkdown([
        clientLane,
        {
          ...e2eLane,
          status: 'failed',
          message:
            'End-to-end feature coverage is below 100%: 246/247 scenarios covered.',
          e2eMetrics: {
            ...e2eLane.e2eMetrics,
            coveredFeatureCount: 97,
            activeFeatureCount: 98,
            coveredScenarioCount: 246,
            requiredScenarioCount: 247,
            featureValues: {
              featureCoverage: { current: 98.98 },
              scenarioCoverage: { current: 99.6 },
            },
          },
        },
      ]);

      markdown.should.containEql('Coverage status: **Needs attention**');
      markdown.should.containEql('<td>✗ Failed</td>');
      markdown.should.containEql('Features           🟡 97/98');
      markdown.should.containEql('Scenario coverage  🟡 99.60%');
    });
  });
});
