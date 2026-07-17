const fs = require('fs');
const os = require('os');
const path = require('path');
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
} = require('../../../../../scripts/coverage/generate-pr-summary');

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
      formatDate('2026-07-03T19:29:00.000Z').should.equal('2026-07-03 19:29');
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
          .map(lane => lane.name)
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
      table.should.containEql('<td>✓</td>');
      table.should.containEql('2026-07-03 19:29<br>Duration 1m 23s');
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
      table.should.containEql('2026-07-03 19:23<br>Duration 4m 12s');
      table.should.containEql('<code>coverage-client</code>');
    });
  });

  describe('renderE2eAreaTable', () => {
    it('renders mapped areas and unmapped specs', () => {
      const table = renderE2eAreaTable(e2eLane);

      table.should.containEql('| Messages | ✓ | 6 | 0 | 6 |');
      table.should.containEql('| Other (unmapped specs) | ✓ | 1 | 0 | 1 |');
      table.should.containEql('| **Total** |  | **7** | **0** | **7** |');
    });
  });

  describe('buildMarkdown', () => {
    it('renders a sticky-comment friendly markdown summary', () => {
      const markdown = buildMarkdown([clientLane, e2eLane], {
        runUrl: 'https://github.com/Trustroots/trustroots/actions/runs/1',
      });

      markdown.should.startWith(marker);
      markdown.should.containEql('## Coverage overview');
      markdown.should.containEql('Status: **Passing**');
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

      markdown.should.containEql('Status: **Needs attention**');
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

      markdown.should.containEql('Status: **Needs attention**');
      markdown.should.containEql('<td>✗ FAILED</td>');
      markdown.should.containEql('Features           🟡 97/98');
      markdown.should.containEql('Scenario coverage  🟡 99.60%');
    });
  });
});
