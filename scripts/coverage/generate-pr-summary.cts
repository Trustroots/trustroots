#!/usr/bin/env node

const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');
const lineChanges = require('./line-changes.cts') as {
  collectLineChanges: (baseSha: string, headSha: string, cwd: string) => LineChanges;
  renderLineChanges: (summary: LineChanges) => string;
};
const { collectLineChanges, renderLineChanges } = lineChanges;
const { renderProductionInventory } = require('./dependency-changes.cts') as {
  renderProductionInventory: (inventory?: ProductionInventory) => string;
};
const { readTimings, renderTimings } = require('./ci-timings.cts') as {
  readTimings: (root: string) => CiTimings | null;
  renderTimings: (timings: CiTimings | null | undefined) => string;
};

interface LineChanges {
  groups: Array<{ id: string; label: string; added: number; removed: number; net: number }>;
  binaryFiles: number;
  dependencies?: Array<{
    label: string;
    added: number;
    removed: number;
    changed: number;
    net: number;
    changes: Array<{ name: string; before: string | undefined; after: string | undefined }>;
  }>;
}

interface ProductionInventory {
  packages: Array<{ name: string; version: string; path: string }>;
}

interface CiTimings {
  collectedAt: string;
  workflows: Array<{
    name: string;
    url: string;
    startedAt: string | null;
    completedAt: string | null;
    jobs: Array<unknown>;
  }>;
  unavailable?: string[];
}

interface MetricValue {
  current?: number | null;
}

interface AreaResult {
  passed: number;
  failed: number;
  total: number;
}

interface Lane {
  name?: string;
  label?: string;
  status?: string;
  kind?: string;
  message?: string;
  artifactName?: string;
  generatedAt?: string;
  durationMs?: number;
  metrics?: Record<string, MetricValue | undefined>;
  e2eMetrics?: {
    durationMs?: number;
    testValues?: Record<string, MetricValue | undefined>;
    featureValues?: Record<string, MetricValue | undefined>;
    byArea?: Record<string, AreaResult>;
    definedAreaCount?: number;
    greenAreaCount?: number;
    activeFeatureCount?: number;
    coveredFeatureCount?: number;
    requiredScenarioCount?: number;
    coveredScenarioCount?: number;
  };
}

interface BuildOptions {
  includeCoverage?: boolean;
  lineChanges?: LineChanges;
  productionInventory?: ProductionInventory;
  timings?: CiTimings | null;
  runUrl?: string | null;
}

const root = path.resolve(__dirname, '../..');
const reportDir = path.join(root, 'coverage-report');
const marker = '<!-- trustroots-coverage-report -->';
const suiteOrder = ['client', 'server', 'e2e'];
const coverageMetrics = ['statements', 'branches', 'functions', 'lines'];

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function formatStatus(status: string | undefined): string {
  const labels: Record<string, string> = {
    blocked: '✗ BLOCKED',
    failed: '✗ FAILED',
    passed: '✓',
    skipped: 'SKIPPED',
    unknown: 'UNKNOWN',
  };
  return labels[status ?? ''] || String(status || 'unknown').toUpperCase();
}

function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : 'n/a';
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) {
    return 'n/a';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return String(isoString);
  }

  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function formatDuration(ms: number | null | undefined): string {
  const seconds = Math.round((ms || 0) / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes === 0) {
    return `${remainder}s`;
  }

  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function escapeMarkdown(value: unknown): string {
  return String(value == null ? '' : value).replace(/\|/g, '\\|');
}

function escapeHtml(value: unknown): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isPerfectValue(value: string): boolean {
  if (value === '100.00%') {
    return true;
  }

  const ratio = /^(\d+)\/(\d+)$/.exec(value);
  return Boolean(ratio && ratio[1] === ratio[2]);
}

function resultSymbol(value: string): string {
  if (isPerfectValue(value)) {
    return '🟢';
  }

  return value === 'n/a' ? '⚪' : '🟡';
}

function resultRowsTable(rows: Array<[string, string]>): string {
  const labelWidth = rows.reduce(
    (width, [label]) => Math.max(width, String(label).length),
    0,
  );
  const body = rows
    .map(([label, value]) => {
      const paddedLabel = String(label).padEnd(labelWidth, ' ');
      return `${paddedLabel}  ${resultSymbol(value)} ${value}`;
    })
    .join('\n');

  return `<pre>${escapeHtml(body)}</pre>`;
}

function coverageResultRows(lane: Lane): Array<[string, string]> {
  const metrics = lane.metrics || {};
  return coverageMetrics.map(metric => {
    const value = metrics[metric] || {};
    const label = metric.charAt(0).toUpperCase() + metric.slice(1);
    return [label, formatPercent(value.current)];
  });
}

function metricCurrent(
  values: Record<string, MetricValue | undefined> | undefined,
  metric: string,
): number | null | undefined {
  return values && values[metric] ? values[metric].current : null;
}

function e2eResultRows(lane: Lane): Array<[string, string]> | null {
  const metrics = lane.e2eMetrics;
  if (!metrics) {
    return null;
  }

  const total = metricCurrent(metrics.testValues, 'total');
  const passed = metricCurrent(metrics.testValues, 'passed');
  const passRate = metricCurrent(metrics.testValues, 'passRate');
  const featureCoverage = metricCurrent(
    metrics.featureValues,
    'featureCoverage',
  );
  const scenarioCoverage = metricCurrent(
    metrics.featureValues,
    'scenarioCoverage',
  );

  return [
    ['Tests', `${passed}/${total}`],
    ['Pass rate', formatPercent(passRate)],
    ['Areas', `${metrics.greenAreaCount}/${metrics.definedAreaCount}`],
    [
      'Features',
      `${metrics.coveredFeatureCount}/${metrics.activeFeatureCount}`,
    ],
    [
      'Scenarios',
      `${metrics.coveredScenarioCount}/${metrics.requiredScenarioCount}`,
    ],
    ['Feature coverage', formatPercent(featureCoverage)],
    ['Scenario coverage', formatPercent(scenarioCoverage)],
  ];
}

function laneResult(lane: Lane): string {
  const rows =
    lane.kind === 'coverage' ? coverageResultRows(lane) : e2eResultRows(lane);

  if (!rows) {
    return escapeHtml(lane.message || 'No end-to-end metrics recorded.');
  }

  return resultRowsTable(rows);
}

function reportName(lane: Lane): string {
  return lane.artifactName
    ? `<code>${escapeHtml(lane.artifactName)}</code>`
    : 'n/a';
}

function recordedValue(lane: Lane): string {
  const durationMs = lane.e2eMetrics
    ? lane.e2eMetrics.durationMs || lane.durationMs
    : lane.durationMs;
  const lines = [escapeHtml(formatDate(lane.generatedAt))];

  if (typeof durationMs === 'number' && durationMs > 0) {
    lines.push(`Duration ${escapeHtml(formatDuration(durationMs))}`);
  }

  return lines.join('<br>');
}

function readLanes(inputDir: string = reportDir): Lane[] {
  return suiteOrder
    .map(suiteName => {
      const filePath = path.join(inputDir, `${suiteName}.json`);
      return fs.existsSync(filePath) ? readJson<Lane>(filePath) : null;
    })
    .filter((lane): lane is Lane => Boolean(lane));
}

function areaLabel(area: string): string {
  return area === 'Other' ? 'Other (unmapped specs)' : area;
}

function areaStatus(result: AreaResult): string {
  if (result.failed > 0) {
    return '✗ Failing';
  }

  if (result.passed > 0) {
    return '✓';
  }

  return 'Skipped';
}

function renderOverviewTable(lanes: Lane[]): string {
  const rows = lanes
    .map(lane => {
      return (
        '<tr>' +
        `<td>${escapeHtml(lane.label || lane.name)}</td>` +
        `<td>${escapeHtml(formatStatus(lane.status))}</td>` +
        `<td>${recordedValue(lane)}</td>` +
        `<td>${laneResult(lane)}</td>` +
        `<td>${reportName(lane)}</td>` +
        '</tr>'
      );
    })
    .join('\n');

  return [
    '<table>',
    '<thead>',
    '<tr>',
    '<th>Suite</th>',
    '<th>Status</th>',
    '<th>Recorded</th>',
    '<th>Result</th>',
    '<th>Report</th>',
    '</tr>',
    '</thead>',
    '<tbody>',
    rows,
    '</tbody>',
    '</table>',
  ].join('\n');
}

function renderE2eAreaTable(lane: Lane | undefined): string {
  if (!lane || !lane.e2eMetrics || !lane.e2eMetrics.byArea) {
    return '';
  }

  const areas = Object.entries(lane.e2eMetrics.byArea).filter(
    ([area]) => area !== 'Setup',
  );
  if (areas.length === 0) {
    return '';
  }

  const rows = areas
    .sort(([a], [b]) => areaLabel(a).localeCompare(areaLabel(b)))
    .map(([area, result]) => {
      return `| ${escapeMarkdown(areaLabel(area))} | ${areaStatus(result)} | ${
        result.passed
      } | ${result.failed} | ${result.total} |`;
    });
  const totals = areas.reduce(
    (sum, [, result]) => ({
      passed: sum.passed + (result.passed || 0),
      failed: sum.failed + (result.failed || 0),
      total: sum.total + (result.total || 0),
    }),
    { passed: 0, failed: 0, total: 0 },
  );

  return [
    '### End-to-end areas',
    '',
    '| Area | Status | Passed | Failed | Total |',
    '| --- | --- | ---: | ---: | ---: |',
    ...rows,
    `| **Total** |  | **${totals.passed}** | **${totals.failed}** | **${totals.total}** |`,
  ].join('\n');
}

function overallStatus(lanes: Lane[]): string {
  if (
    lanes.some(lane => ['failed', 'blocked', 'unknown'].includes(lane.status!))
  ) {
    return 'Needs attention';
  }

  if (lanes.some(lane => lane.status === 'skipped')) {
    return 'Partially refreshed';
  }

  return 'Passing';
}

function buildMarkdown(lanes: Lane[], options: BuildOptions = {}): string {
  if (options.includeCoverage === false) {
    return `${[
      marker,
      '## Pull request overview',
      '',
      renderLineChanges(options.lineChanges!),
      '',
      renderProductionInventory(options.productionInventory),
      '',
      renderTimings(options.timings),
    ].join('\n')}\n`;
  }
  const runUrl = options.runUrl || process.env.GITHUB_RUN_URL;
  const e2eLane = lanes.find(lane => lane.name === 'e2e');
  const details = [
    marker,
    '## Coverage overview',
    '',
    `Status: **${overallStatus(lanes)}**`,
    '',
    renderOverviewTable(lanes),
  ];
  const areaTable = renderE2eAreaTable(e2eLane);

  if (options.lineChanges) {
    details.push('', renderLineChanges(options.lineChanges));
  }
  details.push('', renderProductionInventory(options.productionInventory));
  details.push('', renderTimings(options.timings));

  if (areaTable) {
    details.push('', areaTable);
  }

  details.push(
    '',
    runUrl
      ? `Full HTML overview: download the \`coverage-report\` artifact from [this workflow run](${runUrl}).`
      : 'Full HTML overview: download the `coverage-report` workflow artifact.',
  );

  return `${details.join('\n')}\n`;
}

function run(): void {
  const lanes = readLanes();
  process.stdout.write(
    buildMarkdown(lanes, {
      timings: readTimings(root),
      includeCoverage: process.env.TRUSTROOTS_PR_INCLUDE_COVERAGE !== 'false',
      productionInventory: fs.existsSync(
        path.join(root, 'coverage/production/dependencies.json'),
      )
        ? readJson(path.join(root, 'coverage/production/dependencies.json'))
        : undefined,
      lineChanges:
        process.env.PR_BASE_SHA && process.env.PR_HEAD_SHA
          ? collectLineChanges(
              process.env.PR_BASE_SHA,
              process.env.PR_HEAD_SHA,
              root,
            )
          : undefined,
      runUrl:
        process.env.GITHUB_SERVER_URL &&
        process.env.GITHUB_REPOSITORY &&
        process.env.GITHUB_RUN_ID
          ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
          : null,
    }),
  );
}

if (require.main === module) {
  run();
}

module.exports = {
  areaLabel,
  buildMarkdown,
  formatDate,
  formatDuration,
  marker,
  readLanes,
  renderE2eAreaTable,
  renderOverviewTable,
};
