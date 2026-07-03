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
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trustroots-pr-summary-'));
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

      table.should.containEql('| Suite | Status | Recorded | Result | Report |');
      table.should.containEql('Statements 100.00%');
      table.should.containEql('Branches 99.95%');
      table.should.containEql('Tests 136/136');
      table.should.containEql('Scenarios 236/236');
      table.should.containEql('`coverage-client`');
    });
  });

  describe('renderE2eAreaTable', () => {
    it('renders mapped areas and unmapped specs', () => {
      const table = renderE2eAreaTable(e2eLane);

      table.should.containEql('| Messages | Passing | 6 | 0 | 6 |');
      table.should.containEql('| Other (unmapped specs) | Passing | 1 | 0 | 1 |');
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
  });
});
