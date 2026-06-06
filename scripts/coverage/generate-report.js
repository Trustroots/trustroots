#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outputDir = path.join(root, 'coverage-report');
const outputPath = path.join(outputDir, 'index.html');
const baselinePath = path.join(root, 'coverage-baseline.json');
const metrics = ['statements', 'branches', 'functions', 'lines'];
const e2eTestMetrics = ['total', 'passed', 'failed', 'passRate'];
const e2eTestMetricLabels = {
  total: 'Tests',
  passed: 'Passed',
  failed: 'Failed',
  passRate: 'Pass rate',
};
const metricHelp = {
  suite: 'The test suite these coverage numbers came from.',
  statements: 'Executable JavaScript statements that were run by tests.',
  branches:
    'Conditional code paths run by tests, such as if/else, ternaries, and switches.',
  functions: 'Functions and methods called by tests.',
  lines: 'Source lines executed by tests.',
};
const e2eTestMetricHelp = {
  total: 'Number of Playwright tests executed in the latest end-to-end run.',
  passed: 'Tests that completed successfully.',
  failed: 'Tests that failed, timed out, or were interrupted.',
  passRate: 'Percentage of executed tests that passed.',
};
const e2eAreaMetricHelp = {
  areaCoverage:
    'Percentage of defined product areas that ran at least one Playwright test.',
  areaPassCoverage:
    'Percentage of defined product areas with no failing Playwright tests.',
};
const coverageSuites = {
  client: {
    name: 'client',
    label: 'Client',
    kind: 'coverage',
    summaryPath: path.join(root, 'coverage/client/coverage-summary.json'),
    statusPath: path.join(root, 'coverage/client/coverage-status.json'),
    htmlPath: path.join(root, 'coverage/client/index.html'),
    artifactName: 'coverage-client',
    command: 'npm run test:coverage:client',
  },
  server: {
    name: 'server',
    label: 'Server',
    kind: 'coverage',
    summaryPath: path.join(root, 'coverage/server/coverage-summary.json'),
    statusPath: path.join(root, 'coverage/server/coverage-status.json'),
    htmlPath: path.join(root, 'coverage/server/index.html'),
    artifactName: 'coverage-server',
    command: 'npm run test:coverage:server',
  },
};
const testSuites = {
  e2e: {
    name: 'e2e',
    label: 'End-to-end',
    kind: 'test',
    description:
      'Playwright tests for auth, profiles, circles, messages, admin, Nostr, and public pages.',
    statusPath: path.join(root, 'coverage/e2e/status.json'),
    htmlPath: path.join(root, 'playwright-report/index.html'),
    artifactName: 'playwright-report',
    command: 'npm run test:e2e',
  },
};
const reportSuites = {
  ...coverageSuites,
  ...testSuites,
};
const suiteOrder = ['client', 'server', 'e2e'];
const statusValues = ['passed', 'failed', 'skipped', 'blocked', 'unknown'];
const args = process.argv.slice(2);
const scopeArg = args.find(arg => arg.startsWith('--scope='));
const scope = scopeArg ? scopeArg.split('=')[1] : null;

if (scope && !reportSuites[scope]) {
  console.error(`Unknown report scope "${scope}".`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function relativeHref(filePath) {
  return path.relative(outputDir, filePath).replace(/\\/g, '/');
}

function readStatus(suite) {
  if (!fs.existsSync(suite.statusPath)) {
    return null;
  }

  return readJson(suite.statusPath);
}

function getRunUrl() {
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;

  if (!repository || !runId) {
    return null;
  }

  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}

function formatDatetime(isoString) {
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

function fileGeneratedAt(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return new Date(fs.statSync(filePath).mtimeMs).toISOString();
}

function getMetadata() {
  const runUrl = getRunUrl();
  const generatedAt = new Date().toISOString();
  return {
    branch: process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || 'local',
    commit: process.env.GITHUB_SHA || 'local',
    generatedAt,
    generatedAtDisplay: formatDatetime(generatedAt),
    isGitHubActions: process.env.GITHUB_ACTIONS === 'true',
    runUrl,
  };
}

function normalizeStatus(status) {
  return statusValues.includes(status) ? status : 'unknown';
}

function copyDirectoryRecursive(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return false;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }

  return true;
}

function syncBundledPlaywrightReport() {
  const sourceDir = path.join(root, 'playwright-report');
  const targetDir = path.join(outputDir, 'playwright-report');

  if (!fs.existsSync(path.join(sourceDir, 'index.html'))) {
    return null;
  }

  copyDirectoryRecursive(sourceDir, targetDir);
  return path.join(targetDir, 'index.html');
}

function syncBundledCoverageReport(suite) {
  if (!fs.existsSync(suite.htmlPath)) {
    return null;
  }

  const sourceDir = path.dirname(suite.htmlPath);
  const targetDir = path.join(outputDir, suite.name);

  copyDirectoryRecursive(sourceDir, targetDir);
  return path.join(targetDir, 'index.html');
}

function syncBundledCoverageReports() {
  for (const suite of Object.values(coverageSuites)) {
    syncBundledCoverageReport(suite);
  }
}

function localReportHref(suite) {
  if (suite.name === 'e2e') {
    const bundledReport = path.join(outputDir, 'playwright-report', 'index.html');
    if (fs.existsSync(bundledReport)) {
      return relativeHref(bundledReport);
    }
  }

  if (suite.kind === 'coverage') {
    const bundledReport = path.join(outputDir, suite.name, 'index.html');
    if (fs.existsSync(bundledReport)) {
      return relativeHref(bundledReport);
    }
  }

  return fs.existsSync(suite.htmlPath) ? relativeHref(suite.htmlPath) : null;
}

function shouldSkipMissingCoverage(suiteName, metadata) {
  if (metadata.isGitHubActions) {
    return false;
  }

  if (scope && scope !== suiteName) {
    return true;
  }

  return suiteName !== 'client';
}

function shouldSkipMissingTest(suiteName) {
  return scope !== suiteName;
}

function baseLane(suite, metadata) {
  return {
    name: suite.name,
    label: suite.label,
    kind: suite.kind,
    status: 'unknown',
    message: 'No status message was recorded.',
    generatedAt: metadata.generatedAt,
    command: suite.command,
    artifactName: suite.artifactName,
    localReportHref: localReportHref(suite),
  };
}

function coverageMissingLane(suiteName, metadata) {
  const suite = coverageSuites[suiteName];
  const status = readStatus(suite);
  const lane = {
    ...baseLane(suite, metadata),
    metrics: {},
  };

  if (status) {
    return {
      ...lane,
      status: normalizeStatus(status.status),
      message: status.message || 'Coverage did not produce a summary.',
      command: status.command || suite.command,
    };
  }

  if (shouldSkipMissingCoverage(suiteName, metadata)) {
    return {
      ...lane,
      status: 'skipped',
      message: `${suite.label} coverage was not refreshed for this report run.`,
    };
  }

  return {
    ...lane,
    status: 'unknown',
    message: `${suite.label} coverage summary is missing, so this suite was not ratchet-checked.`,
  };
}

function readCoverageLane(suiteName, baseline, metadata) {
  const suite = coverageSuites[suiteName];

  if (!fs.existsSync(suite.summaryPath)) {
    return coverageMissingLane(suiteName, metadata);
  }

  const summary = readJson(suite.summaryPath);
  const status = readStatus(suite);
  const metricValues = metrics.reduce((result, metric) => {
    const current = summary.total[metric].pct;
    const expected = baseline[suiteName] && baseline[suiteName][metric];
    result[metric] = {
      current,
      baseline: expected,
      delta: typeof expected === 'number' ? current - expected : null,
      passed: typeof expected === 'number' ? current >= expected : true,
    };
    return result;
  }, {});
  const passed = metrics.every(metric => metricValues[metric].passed);
  const generatedAt =
    (status && status.generatedAt) ||
    fileGeneratedAt(suite.summaryPath) ||
    metadata.generatedAt;

  return {
    ...baseLane(suite, metadata),
    status: passed ? 'passed' : 'failed',
    message: passed
      ? `${suite.label} coverage meets the checked-in baseline.`
      : `${suite.label} coverage is below the checked-in baseline.`,
    generatedAt,
    metrics: metricValues,
  };
}

function buildMetricComparison(current, expected) {
  if (typeof current !== 'number') {
    return {
      current: null,
      baseline: expected,
      delta: null,
      passed: typeof expected !== 'number',
    };
  }

  return {
    current,
    baseline: expected,
    delta: typeof expected === 'number' ? current - expected : null,
    passed: typeof expected !== 'number' ? true : current >= expected,
  };
}

function buildE2eCodeCoverage(statusMetrics, baseline = {}) {
  const code = statusMetrics.codeCoverage;
  if (!code) {
    return null;
  }

  return metrics.reduce((result, metric) => {
    const expected = baseline.code && baseline.code[metric];
    result[metric] = buildMetricComparison(code[metric], expected);
    return result;
  }, {});
}

function buildE2eMetrics(statusMetrics, baseline = {}) {
  if (!statusMetrics) {
    return null;
  }

  const expectedTests = baseline.tests;
  const expectedPassRate = baseline.passRate;
  const testValues = {
    total: buildMetricComparison(statusMetrics.total, expectedTests),
    passed: buildMetricComparison(statusMetrics.passed, expectedTests),
    failed: {
      current: statusMetrics.failed,
      baseline: 0,
      delta: statusMetrics.failed,
      passed: statusMetrics.failed === 0,
    },
    passRate: buildMetricComparison(statusMetrics.passRate, expectedPassRate),
  };
  const areaValues = {
    areaCoverage: buildMetricComparison(
      statusMetrics.areaCoverage,
      baseline.areaCoverage,
    ),
    areaPassCoverage: buildMetricComparison(
      statusMetrics.areaPassCoverage,
      baseline.areaPassCoverage,
    ),
  };
  const codeCoverage = buildE2eCodeCoverage(statusMetrics, baseline);
  const codePassed =
    !codeCoverage ||
    metrics.every(metric => !codeCoverage[metric] || codeCoverage[metric].passed);

  return {
    testValues,
    areaValues,
    codeCoverage,
    durationMs: statusMetrics.durationMs || 0,
    areas: (statusMetrics.areas || []).filter(area => area !== 'Setup'),
    byArea: statusMetrics.byArea || {},
    definedAreaCount: statusMetrics.definedAreaCount || 0,
    exercisedAreaCount: statusMetrics.exercisedAreaCount || 0,
    greenAreaCount: statusMetrics.greenAreaCount || 0,
    passed:
      e2eTestMetrics.every(metric => testValues[metric].passed) &&
      Object.keys(areaValues).every(metric => areaValues[metric].passed) &&
      codePassed,
  };
}

function readTestLane(suiteName, metadata, baseline) {
  const suite = testSuites[suiteName];
  const lane = baseLane(suite, metadata);
  const status = readStatus(suite);

  if (!status) {
    if (shouldSkipMissingTest(suiteName)) {
      return {
        ...lane,
        status: 'skipped',
        message: `${suite.label} tests were not refreshed for this report run.`,
      };
    }

    return {
      ...lane,
      status: 'unknown',
      message: `Run ${suite.command} to add this suite to the report.`,
    };
  }

  const e2eMetricValues = buildE2eMetrics(status.metrics, baseline.e2e);

  return {
    ...lane,
    status: normalizeStatus(status.status),
    message: status.message || 'No status message was recorded.',
    command: status.command || suite.command,
    generatedAt: status.generatedAt || metadata.generatedAt,
    e2eMetrics: e2eMetricValues,
  };
}

function readReportLane(suiteName, baseline, metadata) {
  if (coverageSuites[suiteName]) {
    return readCoverageLane(suiteName, baseline, metadata);
  }

  return readTestLane(suiteName, metadata, baseline);
}

function outputJsonPath(suiteName) {
  return path.join(outputDir, `${suiteName}.json`);
}

function skippedLaneFromConfig(suiteName, metadata) {
  const suite = reportSuites[suiteName];
  return {
    ...baseLane(suite, metadata),
    status: 'skipped',
    message: `${suite.label} was not refreshed for this report run.`,
    metrics: suite.kind === 'coverage' ? {} : undefined,
  };
}

function laneWithConfig(suiteName, lane) {
  const suite = reportSuites[suiteName];
  return {
    name: suite.name,
    label: suite.label,
    kind: suite.kind,
    description: suite.description || '',
    command: suite.command,
    artifactName: suite.artifactName,
    ...lane,
    localReportHref: localReportHref(suite) || lane.localReportHref || null,
  };
}

function staleLaneFromExisting(suiteName, lane, metadata) {
  const suite = reportSuites[suiteName];
  const previousStatus = normalizeStatus(lane.status);
  return {
    ...laneWithConfig(suiteName, lane),
    status: 'skipped',
    previousStatus,
    stale: true,
    message: `${suite.label} was not refreshed for this report run; showing the previous ${previousStatus} result.`,
    reportGeneratedAt: metadata.generatedAt,
  };
}

function readInitialLane(suiteName, selectedSuites, baseline, metadata) {
  if (selectedSuites.includes(suiteName)) {
    return readReportLane(suiteName, baseline, metadata);
  }

  const jsonPath = outputJsonPath(suiteName);
  if (!fs.existsSync(jsonPath)) {
    return skippedLaneFromConfig(suiteName, metadata);
  }

  return staleLaneFromExisting(suiteName, readJson(jsonPath), metadata);
}

function renderHelpLabel(label, helpText) {
  const text = escapeHtml(helpText);
  return `
    <span
      class="help-label"
      tabindex="0"
      title="${text}"
      aria-label="${escapeHtml(`${label}: ${helpText}`)}"
    >
      ${escapeHtml(label)}
      <span class="help-marker" aria-hidden="true">?</span>
      <span class="help-tooltip" role="tooltip">${text}</span>
    </span>
  `;
}

function renderHeader(metric, isBaseline = false) {
  const label = isBaseline ? `${metric} baseline` : metric;
  return `<th>${renderHelpLabel(
    label,
    metricHelpText(metric, isBaseline),
  )}</th>`;
}

function capitalizeMetric(metric) {
  return metric.charAt(0).toUpperCase() + metric.slice(1);
}

function renderSuiteTableHead() {
  const groupHeaders = metrics
    .map(metric => {
      const label = capitalizeMetric(metric);
      const helpText =
        metric === 'statements'
          ? `${metricHelp[metric]} For end-to-end, this is client code coverage collected during Playwright runs.`
          : metricHelp[metric] || metric;
      return `<th colspan="2">${renderHelpLabel(label, helpText)}</th>`;
    })
    .join('');
  const subHeaders = metrics
    .map(() => '<th class="subhead">Current</th><th class="subhead">Baseline</th>')
    .join('');

  return `
    <tr>
      <th rowspan="2">${renderHelpLabel('Suite', metricHelp.suite)}</th>
      <th rowspan="2">Status</th>
      <th rowspan="2">${renderHelpLabel(
        'Recorded',
        'When this suite last produced the results shown in the row.',
      )}</th>
      ${groupHeaders}
      <th rowspan="2">Report</th>
    </tr>
    <tr>${subHeaders}</tr>
  `;
}

function metricHelpText(metric, isBaseline = false) {
  const metricDescription = metricHelp[metric] || metric;

  if (!isBaseline) {
    return metricDescription;
  }

  return `Checked-in minimum for ${metric}. The ratchet fails when current ${metric} coverage drops below this value.`;
}

function renderReportShell(metadata, initialLanes) {
  const runLink = metadata.runUrl
    ? `<a href="${escapeHtml(metadata.runUrl)}">GitHub Actions run</a>`
    : 'local run';
  const shortSha =
    metadata.commit === 'local' ? 'local' : metadata.commit.slice(0, 12);
  const summaryText = metadata.isGitHubActions
    ? 'Latest master coverage summary generated by GitHub Actions.'
    : 'Coverage summary generated locally from available coverage data.';
  const suiteConfig = suiteOrder.map(suiteName => {
    const suite = reportSuites[suiteName];
    return {
      name: suite.name,
      label: suite.label,
      kind: suite.kind,
      description: suite.description || '',
      command: suite.command,
      artifactName: suite.artifactName,
    };
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Trustroots Coverage Report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f7f4;
        --panel: #ffffff;
        --text: #20231f;
        --muted: #61665c;
        --border: #d9ded3;
        --pass: #177245;
        --pass-bg: #e7f4eb;
        --fail: #a33a2b;
        --fail-bg: #f8e8e5;
        --warn: #8a5a00;
        --warn-bg: #fff3cf;
        --skip: #58606a;
        --skip-bg: #eef0f2;
        --accent: #246b8f;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.45;
      }
      main {
        max-width: 1240px;
        margin: 0 auto;
        padding: 40px 24px;
      }
      header {
        display: flex;
        gap: 24px;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 28px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 32px;
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: var(--muted);
      }
      a {
        color: var(--accent);
      }
      .status {
        min-width: 160px;
        padding: 12px 16px;
        border: 1px solid;
        border-radius: 6px;
        font-weight: 700;
        text-align: center;
      }
      .status.pass {
        color: var(--pass);
        background: var(--pass-bg);
        border-color: #b8ddc4;
      }
      .status.fail {
        color: var(--fail);
        background: var(--fail-bg);
        border-color: #e4b7ae;
      }
      .status.warn {
        color: var(--warn);
        background: var(--warn-bg);
        border-color: #e6c86f;
      }
      .status.skip {
        color: var(--skip);
        background: var(--skip-bg);
        border-color: #cfd5db;
      }
      section {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        margin: 18px 0;
        overflow: hidden;
      }
      .section-body {
        padding: 20px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 8px 10px;
        border-bottom: 1px solid var(--border);
        text-align: right;
        white-space: nowrap;
        vertical-align: middle;
      }
      th:first-child,
      td:first-child,
      th:nth-child(2),
      td:nth-child(2),
      th:nth-child(3),
      td:nth-child(3) {
        text-align: left;
      }
      thead th {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      thead th.subhead {
        font-size: 11px;
        font-weight: 600;
      }
      .suite-table .suite-name {
        font-weight: 700;
      }
      .suite-table .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border: 1px solid transparent;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.3;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .suite-table .status-badge.pass {
        color: var(--pass);
        background: var(--pass-bg);
        border-color: #b8ddc4;
      }
      .suite-table .status-badge.fail {
        color: var(--fail);
        background: var(--fail-bg);
        border-color: #e4b7ae;
      }
      .suite-table .status-badge.warn {
        color: var(--warn);
        background: var(--warn-bg);
        border-color: #e6c86f;
      }
      .suite-table .status-badge.skip {
        color: var(--skip);
        background: var(--skip-bg);
        border-color: #cfd5db;
      }
      .suite-table .suite-note {
        display: block;
        margin-top: 2px;
        color: var(--muted);
        font-size: 11px;
        font-weight: 400;
        line-height: 1.2;
        text-transform: none;
        letter-spacing: 0;
        white-space: nowrap;
      }
      .suite-table .report-link {
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
      }
      .suite-table .report-link:hover {
        text-decoration: underline;
      }
      .suite-table .metric-value {
        font-variant-numeric: tabular-nums;
      }
      .suite-table .metric-value.pass {
        color: var(--pass);
        font-weight: 700;
      }
      .suite-table .metric-value.fail {
        color: var(--fail);
        font-weight: 700;
      }
      .help-label {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        outline: none;
      }
      .help-marker {
        display: inline-grid;
        width: 16px;
        height: 16px;
        place-items: center;
        border: 1px solid var(--border);
        border-radius: 50%;
        color: var(--accent);
        font-size: 11px;
        line-height: 1;
        text-transform: none;
      }
      .help-tooltip {
        position: absolute;
        z-index: 2;
        top: calc(100% + 8px);
        left: 0;
        width: min(260px, 70vw);
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--text);
        color: #fff;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
        font-size: 12px;
        font-weight: 500;
        line-height: 1.35;
        opacity: 0;
        pointer-events: none;
        text-align: left;
        text-transform: none;
        transform: translateY(-2px);
        transition: opacity 120ms ease, transform 120ms ease;
        white-space: normal;
      }
      .subtle {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 400;
        white-space: normal;
      }
      .test-report-table th,
      .test-report-table td {
        text-align: left;
        vertical-align: top;
        white-space: normal;
      }
      .test-report-table td:nth-child(2) {
        font-weight: 700;
        white-space: nowrap;
      }
      .help-label:hover .help-tooltip,
      .help-label:focus .help-tooltip {
        opacity: 1;
        transform: translateY(0);
      }
      tbody tr:last-child td {
        border-bottom: 0;
      }
      td.pass {
        color: var(--pass);
        font-weight: 700;
      }
      td.fail {
        color: var(--fail);
        font-weight: 700;
      }
      td.warn {
        color: var(--warn);
        font-weight: 700;
      }
      td.skip,
      td.baseline,
      td.missing {
        color: var(--muted);
      }
      .delta {
        display: inline;
        margin-left: 4px;
        font-size: 11px;
        font-weight: 600;
      }
      .delta.pass {
        color: var(--pass);
      }
      .delta.fail {
        color: var(--fail);
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
      }
      .meta strong {
        display: block;
        margin-bottom: 3px;
      }
      .artifact-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }
      .artifact {
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 8px 10px;
        background: #fbfbf9;
        color: var(--text);
        text-decoration: none;
      }
      .status-details {
        margin: 12px 0 0;
        padding-left: 20px;
        color: var(--muted);
      }
      @media (max-width: 760px) {
        header {
          display: block;
        }
        .status {
          margin-top: 16px;
          text-align: left;
        }
        .table-wrap {
          overflow-x: auto;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Trustroots Coverage Report</h1>
          <p>${escapeHtml(summaryText)}</p>
        </div>
        <div id="overall-status" class="status skip">Loading</div>
      </header>

      <section>
        <div class="table-wrap">
          <table class="suite-table">
            <thead>
              ${renderSuiteTableHead()}
            </thead>
            <tbody id="suite-body"></tbody>
          </table>
        </div>
      </section>

      <section id="e2e-area-section" hidden>
        <div class="section-body" id="e2e-area-metrics"></div>
      </section>

      <section>
        <div class="section-body">
          <strong>Status details</strong>
          <ul id="status-details" class="status-details"></ul>
        </div>
      </section>

      <section>
        <div class="section-body meta">
          <div>
            <strong>Branch</strong>
            ${escapeHtml(metadata.branch)}
          </div>
          <div>
            <strong>Commit</strong>
            ${escapeHtml(shortSha)}
          </div>
          <div>
            <strong>Generated</strong>
            ${escapeHtml(metadata.generatedAtDisplay)}
          </div>
          <div>
            <strong>Workflow</strong>
            ${runLink}
          </div>
        </div>
      </section>

      <section id="detailed-reports" hidden>
        <div class="section-body">
          <strong>Detailed reports</strong>
          <p id="detailed-reports-copy"></p>
          <div id="artifact-list" class="artifact-list"></div>
        </div>
      </section>
    </main>
    <script>
      var reportMetadata = ${JSON.stringify(metadata)};
      var suiteConfig = ${JSON.stringify(suiteConfig)};
      var initialLaneData = ${JSON.stringify(initialLanes)};
      var metrics = ${JSON.stringify(metrics)};
      var e2eTestMetrics = ${JSON.stringify(e2eTestMetrics)};
      var e2eTestMetricLabels = ${JSON.stringify(e2eTestMetricLabels)};

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function formatPercent(value) {
        if (typeof value !== 'number') {
          return 'n/a';
        }

        return value.toFixed(2) + '%';
      }

      function formatDelta(value) {
        if (typeof value !== 'number') {
          return '';
        }

        return (value >= 0 ? '+' : '') + value.toFixed(2);
      }

      function formatDuration(durationMs) {
        if (typeof durationMs !== 'number' || durationMs <= 0) {
          return 'n/a';
        }

        var totalSeconds = Math.round(durationMs / 1000);
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = totalSeconds % 60;

        if (minutes === 0) {
          return seconds + 's';
        }

        return minutes + 'm ' + seconds + 's';
      }

      function formatDatetime(isoString) {
        if (!isoString) {
          return 'n/a';
        }

        var date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
          return String(isoString);
        }

        function pad(value) {
          return String(value).padStart(2, '0');
        }

        return (
          date.getUTCFullYear() +
          '-' +
          pad(date.getUTCMonth() + 1) +
          '-' +
          pad(date.getUTCDate()) +
          ' ' +
          pad(date.getUTCHours()) +
          ':' +
          pad(date.getUTCMinutes())
        );
      }

      function formatE2eMetricValue(metric, value) {
        if (typeof value !== 'number') {
          return 'n/a';
        }

        if (metric === 'passRate') {
          return value.toFixed(2) + '%';
        }

        return String(value);
      }

      function renderSuiteNameCell(lane) {
        var title = lane.description
          ? ' title="' + escapeHtml(lane.description) + '"'
          : '';
        return '<span class="suite-name"' + title + '>' + escapeHtml(lane.label) + '</span>';
      }

      function renderStatusCell(lane) {
        var html =
          '<span class="status-badge ' +
          statusClass(lane.status) +
          '">' +
          escapeHtml(statusLabel(lane.status)) +
          '</span>';

        if (lane.stale) {
          html += '<span class="suite-note">Previous run</span>';
        } else if (lane.previousStatus) {
          html +=
            '<span class="suite-note">Was ' +
            escapeHtml(statusLabel(lane.previousStatus)) +
            '</span>';
        }

        return html;
      }

      function renderReportCell(lane) {
        if (!lane.localReportHref) {
          return '<span class="suite-note">—</span>';
        }

        return (
          '<a class="report-link" href="' +
          escapeHtml(lane.localReportHref) +
          '">HTML</a>'
        );
      }

      function renderMetricValue(className, current, delta, deltaClass) {
        var html =
          '<span class="metric-value ' +
          className +
          '">' +
          escapeHtml(current) +
          '</span>';

        if (delta) {
          html +=
            '<span class="delta ' +
            deltaClass +
            '">' +
            escapeHtml(delta) +
            '</span>';
        }

        return html;
      }

      function skippedLane(config, message) {
        return {
          name: config.name,
          label: config.label,
          kind: config.kind,
          description: config.description || '',
          status: 'skipped',
          message: message,
          generatedAt: reportMetadata.generatedAt,
          command: config.command,
          artifactName: config.artifactName,
          localReportHref: null,
          metrics: config.kind === 'coverage' ? {} : undefined,
        };
      }

      function staleLane(config, lane, message) {
        if (!lane) {
          return skippedLane(config, message);
        }

        return Object.assign({}, config, lane, {
          status: 'skipped',
          previousStatus: lane.previousStatus || lane.status || 'unknown',
          stale: true,
          message: message,
          reportGeneratedAt: reportMetadata.generatedAt,
        });
      }

      function normalizeLane(config, lane) {
        if (!lane) {
          return skippedLane(
            config,
            config.label + ' report data is not available for this report run.',
          );
        }

        if (lane.reportGeneratedAt === reportMetadata.generatedAt) {
          return Object.assign({}, config, lane);
        }

        if (lane.generatedAt === reportMetadata.generatedAt) {
          return Object.assign({}, config, lane);
        }

        return staleLane(
          config,
          lane,
          config.label + ' was not refreshed for this report run; showing the previous ' +
            statusLabel(lane.previousStatus || lane.status || 'unknown').toLowerCase() +
            ' result.',
        );
      }

      async function loadLane(config) {
        try {
          var response = await fetch(config.name + '.json', { cache: 'no-store' });
          if (!response.ok) {
            throw new Error('Report data was not found.');
          }

          var lane = await response.json();
          return normalizeLane(config, lane);
        } catch (error) {
          return normalizeLane(config, initialLaneData[config.name]);
        }
      }

      function statusClass(status) {
        if (status === 'passed') {
          return 'pass';
        }

        if (status === 'failed') {
          return 'fail';
        }

        if (status === 'skipped') {
          return 'skip';
        }

        return 'warn';
      }

      function statusLabel(status) {
        var labels = {
          blocked: 'Blocked',
          failed: 'Failed',
          passed: 'Passed',
          skipped: 'Skipped',
          unknown: 'Unknown',
        };
        return labels[status] || status;
      }

      function renderMetricCells(lane) {
        if (!lane.metrics || Object.keys(lane.metrics).length === 0) {
          return '<td class="missing" colspan="' + metrics.length * 2 + '">' +
            escapeHtml(lane.message) +
            '</td>';
        }

        return metrics
          .map(function (metric) {
            var values = lane.metrics[metric] || {};
            var className = values.passed ? 'pass' : 'fail';
            var deltaClass = values.delta >= 0 ? 'pass' : 'fail';
            return (
              '<td>' +
                renderMetricValue(
                  className,
                  formatPercent(values.current),
                  formatDelta(values.delta),
                  deltaClass,
                ) +
              '</td>' +
              '<td class="baseline metric-value">' +
                escapeHtml(formatPercent(values.baseline)) +
              '</td>'
            );
          })
          .join('');
      }

      function renderSuiteTable(lanes) {
        var rows = lanes
          .map(function (lane) {
            var metricCells;
            if (lane.kind === 'coverage') {
              metricCells = renderMetricCells(lane);
            } else if (lane.e2eMetrics && lane.e2eMetrics.codeCoverage) {
              metricCells = renderMetricCells({
                metrics: lane.e2eMetrics.codeCoverage,
                message: lane.message,
              });
            } else {
              metricCells =
                '<td class="missing" colspan="' +
                metrics.length * 2 +
                '">' +
                escapeHtml(
                  lane.message ||
                    'End-to-end code coverage is not available for this run.',
                ) +
                '</td>';
            }

            return (
              '<tr>' +
                '<td>' + renderSuiteNameCell(lane) + '</td>' +
                '<td>' + renderStatusCell(lane) + '</td>' +
                '<td class="baseline metric-value">' +
                  escapeHtml(formatDatetime(lane.generatedAt)) +
                '</td>' +
                metricCells +
                '<td>' + renderReportCell(lane) + '</td>' +
              '</tr>'
            );
          })
          .join('');
        document.getElementById('suite-body').innerHTML = rows;
      }

      function renderE2eAreaMetrics(lanes) {
        var lane = lanes.find(function (item) {
          return item.name === 'e2e';
        });
        var section = document.getElementById('e2e-area-section');
        var areaMetrics = document.getElementById('e2e-area-metrics');

        if (!lane || !lane.e2eMetrics || lane.status === 'skipped') {
          section.hidden = true;
          return;
        }

        section.hidden = false;

        var areaCoverage = lane.e2eMetrics.areaValues || {};
        var testValues = lane.e2eMetrics.testValues || {};
        var summaryParts = [
          'Duration ' + formatDuration(lane.e2eMetrics.durationMs),
          formatE2eMetricValue('passRate', testValues.passRate.current) +
            ' pass rate (' +
            String(testValues.passed.current) +
            '/' +
            String(testValues.total.current) +
            ' tests)',
        ];

        if (typeof areaCoverage.areaCoverage.current === 'number') {
          summaryParts.push(
            formatPercent(areaCoverage.areaCoverage.current) +
              ' area coverage (' +
              String(lane.e2eMetrics.exercisedAreaCount) +
              '/' +
              String(lane.e2eMetrics.definedAreaCount) +
              ' areas)',
          );
        }

        if (typeof areaCoverage.areaPassCoverage.current === 'number') {
          summaryParts.push(
            formatPercent(areaCoverage.areaPassCoverage.current) +
              ' green areas (' +
              String(lane.e2eMetrics.greenAreaCount) +
              '/' +
              String(lane.e2eMetrics.definedAreaCount) +
              ')',
          );
        }

        var areaRows = Object.keys(lane.e2eMetrics.byArea || {})
          .filter(function (area) {
            return area !== 'Setup';
          })
          .sort()
          .map(function (area) {
            var areaValues = lane.e2eMetrics.byArea[area];
            var areaStatus = 'Skipped';
            var areaClass = 'skip';

            if (areaValues.total > 0) {
              if (areaValues.failed > 0) {
                areaStatus = 'Failing';
                areaClass = 'fail';
              } else if (areaValues.passed > 0) {
                areaStatus = 'Passing';
                areaClass = 'pass';
              }
            }

            return (
              '<tr>' +
                '<td><strong>' + escapeHtml(area) + '</strong></td>' +
                '<td class="' + areaClass + '">' + escapeHtml(areaStatus) + '</td>' +
                '<td>' + escapeHtml(String(areaValues.passed)) + '</td>' +
                '<td>' + escapeHtml(String(areaValues.failed)) + '</td>' +
                '<td>' + escapeHtml(String(areaValues.total)) + '</td>' +
              '</tr>'
            );
          })
          .join('');

        if (!areaRows) {
          areaMetrics.innerHTML = '';
          return;
        }

        areaMetrics.innerHTML =
          '<strong>End-to-end test and area coverage</strong>' +
          '<p class="subtle">' + escapeHtml(summaryParts.join(' · ')) + '</p>' +
          '<div class="table-wrap">' +
            '<table class="test-report-table">' +
              '<thead><tr><th>Area</th><th>Status</th><th>Passed</th><th>Failed</th><th>Total</th></tr></thead>' +
              '<tbody>' + areaRows + '</tbody>' +
            '</table>' +
          '</div>';
      }

      function failedMetrics(lanes) {
        var coverageFailures = lanes
          .filter(function (lane) {
            return lane.kind === 'coverage' && lane.status !== 'skipped' && lane.metrics;
          })
          .flatMap(function (lane) {
            return metrics
              .filter(function (metric) {
                return lane.metrics[metric] && !lane.metrics[metric].passed;
              })
              .map(function (metric) {
                return {
                  lane: lane,
                  metric: metric,
                  values: lane.metrics[metric],
                  formatValue: formatPercent,
                };
              });
          });
        var e2eFailures = lanes
          .filter(function (lane) {
            return lane.name === 'e2e' && lane.status !== 'skipped' && lane.e2eMetrics;
          })
          .flatMap(function (lane) {
            var failures = [];

            if (lane.e2eMetrics.codeCoverage) {
              metrics.forEach(function (metric) {
                var values = lane.e2eMetrics.codeCoverage[metric];
                if (values && !values.passed) {
                  failures.push({
                    lane: lane,
                    metric: 'code ' + metric,
                    values: values,
                    formatValue: formatPercent,
                  });
                }
              });
            }

            Object.keys(lane.e2eMetrics.areaValues || {}).forEach(function (metric) {
              var values = lane.e2eMetrics.areaValues[metric];
              if (values && !values.passed) {
                failures.push({
                  lane: lane,
                  metric: metric,
                  values: values,
                  formatValue: formatPercent,
                });
              }
            });

            e2eTestMetrics.forEach(function (metric) {
              var values = lane.e2eMetrics.testValues[metric];
              if (values && !values.passed) {
                failures.push({
                  lane: lane,
                  metric: e2eTestMetricLabels[metric] || metric,
                  values: values,
                  formatValue: function (value) {
                    return formatE2eMetricValue(metric, value);
                  },
                });
              }
            });

            return failures;
          });

        return coverageFailures.concat(e2eFailures);
      }

      function overallStatus(lanes) {
        var active = lanes.filter(function (lane) {
          return lane.status !== 'skipped';
        });

        if (active.some(function (lane) { return lane.status === 'failed'; })) {
          return { className: 'fail', label: 'Checks failing' };
        }

        if (
          active.some(function (lane) {
            return lane.status === 'blocked' || lane.status === 'unknown';
          })
        ) {
          return { className: 'warn', label: 'Checks incomplete' };
        }

        if (
          active.length === 1 &&
          active[0].name === 'client' &&
          active[0].status === 'passed'
        ) {
          return { className: 'pass', label: 'Client checks passing' };
        }

        if (
          active.length > 0 &&
          active.every(function (lane) { return lane.status === 'passed'; })
        ) {
          return { className: 'pass', label: 'Checks passing' };
        }

        return { className: 'skip', label: 'Checks skipped' };
      }

      function renderOverallStatus(lanes) {
        var status = overallStatus(lanes);
        var element = document.getElementById('overall-status');
        element.className = 'status ' + status.className;
        element.textContent = status.label;
      }

      function renderStatusDetails(lanes) {
        var details = [];
        var metricFailures = failedMetrics(lanes);
        var failedTests = lanes.filter(function (lane) {
          return lane.kind === 'test' && lane.status === 'failed';
        });
        var incomplete = lanes.filter(function (lane) {
          return lane.status === 'blocked' || lane.status === 'unknown';
        });
        var passing = lanes.filter(function (lane) {
          return lane.status === 'passed';
        });
        var skipped = lanes.filter(function (lane) {
          return lane.status === 'skipped';
        });

        metricFailures.forEach(function (failure) {
          details.push(
            failure.lane.label +
              ' ' +
              failure.metric +
              ' is ' +
              failure.formatValue(failure.values.current) +
              ', below baseline ' +
              failure.formatValue(failure.values.baseline) +
              ' by ' +
              formatDelta(failure.values.delta) +
              ' points.',
          );
        });
        failedTests.forEach(function (lane) {
          details.push(lane.label + ' tests failed: ' + lane.message);
        });
        incomplete.forEach(function (lane) {
          details.push(lane.label + ' checks are ' + lane.status + ': ' + lane.message);
        });

        if (details.length === 0) {
          if (passing.length > 0 && skipped.length > 0) {
            details.push(
              passing.map(function (lane) { return lane.label; }).join(' and ') +
                ' checks passed. ' +
                skipped.map(function (lane) { return lane.label; }).join(' and ') +
                ' were not refreshed for this report run.',
            );
          } else if (passing.length > 0) {
            details.push(
              'All coverage metrics meet or exceed the checked-in baseline, and recorded test reports passed.',
            );
          } else {
            details.push('No suite data was refreshed for this report run.');
          }
        } else if (passing.length > 0) {
          details.unshift(
            passing.map(function (lane) { return lane.label; }).join(' and ') +
              ' checks passed.',
          );
        }

        document.getElementById('status-details').innerHTML = details
          .map(function (detail) {
            return '<li>' + escapeHtml(detail) + '</li>';
          })
          .join('');
      }

      function renderDetailedReports(lanes) {
        var section = document.getElementById('detailed-reports');
        var copy = document.getElementById('detailed-reports-copy');
        var list = document.getElementById('artifact-list');
        var reports;

        if (reportMetadata.isGitHubActions) {
          reports = lanes
            .filter(function (lane) {
              return lane.status !== 'skipped';
            })
            .map(function (lane) {
              return {
                label: lane.artifactName,
                href: null,
              };
            });
          copy.textContent = 'Download the workflow artifacts from the linked Actions run.';
        } else {
          reports = lanes
            .filter(function (lane) {
              return lane.localReportHref;
            })
            .map(function (lane) {
              return {
                label: lane.label + ' HTML report',
                href: lane.localReportHref,
              };
            });
          copy.textContent = 'Open the HTML reports generated on this machine.';
        }

        if (reports.length === 0) {
          section.hidden = true;
          return;
        }

        section.hidden = false;
        list.innerHTML = reports
          .map(function (report) {
            if (report.href) {
              return (
                '<a class="artifact" href="' +
                escapeHtml(report.href) +
                '">' +
                escapeHtml(report.label) +
                '</a>'
              );
            }

            return '<span class="artifact">' + escapeHtml(report.label) + '</span>';
          })
          .join('');
      }

      async function renderReport() {
        var lanes = await Promise.all(suiteConfig.map(loadLane));
        renderOverallStatus(lanes);
        renderSuiteTable(lanes);
        renderE2eAreaMetrics(lanes);
        renderStatusDetails(lanes);
        renderDetailedReports(lanes);
      }

      renderReport();
    </script>
  </body>
</html>
`;
}

function writeReport() {
  syncBundledPlaywrightReport();
  syncBundledCoverageReports();
  const baseline = fs.existsSync(baselinePath) ? readJson(baselinePath) : {};
  const metadata = getMetadata();
  const selectedSuites = scope ? [scope] : suiteOrder;
  const initialLanes = suiteOrder.reduce((result, suiteName) => {
    result[suiteName] = readInitialLane(
      suiteName,
      selectedSuites,
      baseline,
      metadata,
    );
    return result;
  }, {});

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, renderReportShell(metadata, initialLanes));

  for (const suiteName of selectedSuites) {
    fs.writeFileSync(
      outputJsonPath(suiteName),
      `${JSON.stringify(initialLanes[suiteName], null, 2)}\n`,
    );
  }

  const written = [
    path.relative(root, outputPath),
    ...selectedSuites.map(suiteName =>
      path.relative(root, outputJsonPath(suiteName)),
    ),
  ];
  console.log(`Wrote ${written.join(', ')}.`);
}

writeReport();
