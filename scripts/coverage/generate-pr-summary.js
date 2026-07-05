#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const reportDir = path.join(root, 'coverage-report');
const marker = '<!-- trustroots-coverage-report -->';
const suiteOrder = ['client', 'server', 'e2e'];
const coverageMetrics = ['statements', 'branches', 'functions', 'lines'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatStatus(status) {
  const labels = {
    blocked: '✗ BLOCKED',
    failed: '✗ FAILED',
    passed: '✓',
    skipped: 'SKIPPED',
    unknown: 'UNKNOWN',
  };
  return labels[status] || String(status || 'unknown').toUpperCase();
}

function formatPercent(value) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : 'n/a';
}

function formatDate(isoString) {
  if (!isoString) {
    return 'n/a';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return String(isoString);
  }

  const pad = value => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function formatDuration(ms) {
  const seconds = Math.round((ms || 0) / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes === 0) {
    return `${remainder}s`;
  }

  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function escapeMarkdown(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isPerfectValue(value) {
  if (value === '100.00%') {
    return true;
  }

  const ratio = /^(\d+)\/(\d+)$/.exec(value);
  return Boolean(ratio && ratio[1] === ratio[2]);
}

function resultSymbol(value) {
  if (isPerfectValue(value)) {
    return '🟢';
  }

  return value === 'n/a' ? '⚪' : '🟡';
}

function resultRowsTable(rows) {
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

function coverageResultRows(lane) {
  const metrics = lane.metrics || {};
  return coverageMetrics.map(metric => {
    const value = metrics[metric] || {};
    const label = metric.charAt(0).toUpperCase() + metric.slice(1);
    return [label, formatPercent(value.current)];
  });
}

function metricCurrent(values, metric) {
  return values && values[metric] ? values[metric].current : null;
}

function e2eResultRows(lane) {
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

function laneResult(lane) {
  const rows =
    lane.kind === 'coverage' ? coverageResultRows(lane) : e2eResultRows(lane);

  if (!rows) {
    return escapeHtml(lane.message || 'No end-to-end metrics recorded.');
  }

  return resultRowsTable(rows);
}

function reportName(lane) {
  return lane.artifactName
    ? `<code>${escapeHtml(lane.artifactName)}</code>`
    : 'n/a';
}

function recordedValue(lane) {
  const durationMs = lane.e2eMetrics
    ? lane.e2eMetrics.durationMs || lane.durationMs
    : lane.durationMs;
  const lines = [escapeHtml(formatDate(lane.generatedAt))];

  if (typeof durationMs === 'number' && durationMs > 0) {
    lines.push(`Duration ${escapeHtml(formatDuration(durationMs))}`);
  }

  return lines.join('<br>');
}

function readLanes(inputDir = reportDir) {
  return suiteOrder
    .map(suiteName => {
      const filePath = path.join(inputDir, `${suiteName}.json`);
      return fs.existsSync(filePath) ? readJson(filePath) : null;
    })
    .filter(Boolean);
}

function areaLabel(area) {
  return area === 'Other' ? 'Other (unmapped specs)' : area;
}

function areaStatus(result) {
  if (result.failed > 0) {
    return '✗ Failing';
  }

  if (result.passed > 0) {
    return '✓';
  }

  return 'Skipped';
}

function renderOverviewTable(lanes) {
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

function renderE2eAreaTable(lane) {
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

function overallStatus(lanes) {
  if (
    lanes.some(lane => ['failed', 'blocked', 'unknown'].includes(lane.status))
  ) {
    return 'Needs attention';
  }

  if (lanes.some(lane => lane.status === 'skipped')) {
    return 'Partially refreshed';
  }

  return 'Passing';
}

function buildMarkdown(lanes, options = {}) {
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

function run() {
  const lanes = readLanes();
  process.stdout.write(
    buildMarkdown(lanes, {
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
