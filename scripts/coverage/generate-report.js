#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outputDir = path.join(root, 'coverage-report');
const outputPath = path.join(outputDir, 'index.html');
const baselinePath = path.join(root, 'coverage-baseline.json');
const metrics = ['statements', 'branches', 'functions', 'lines'];
const e2eMetrics = ['total', 'passed', 'failed', 'passRate'];
const e2eMetricLabels = {
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
const e2eMetricHelp = {
  total: 'Number of Playwright tests executed in the latest end-to-end run.',
  passed: 'Tests that completed successfully.',
  failed: 'Tests that failed, timed out, or were interrupted.',
  passRate: 'Percentage of executed tests that passed.',
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

function localReportHref(suite) {
  if (suite.name === 'e2e') {
    const bundledReport = path.join(outputDir, 'playwright-report', 'index.html');
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

function buildE2eMetrics(statusMetrics, baseline = {}) {
  if (!statusMetrics) {
    return null;
  }

  const expectedTests = baseline.tests;
  const expectedPassRate = baseline.passRate;
  const values = {
    total: {
      current: statusMetrics.total,
      baseline: expectedTests,
      delta:
        typeof expectedTests === 'number'
          ? statusMetrics.total - expectedTests
          : null,
      passed:
        typeof expectedTests !== 'number' || statusMetrics.total >= expectedTests,
    },
    passed: {
      current: statusMetrics.passed,
      baseline: expectedTests,
      delta:
        typeof expectedTests === 'number'
          ? statusMetrics.passed - expectedTests
          : null,
      passed:
        typeof expectedTests !== 'number' || statusMetrics.passed >= expectedTests,
    },
    failed: {
      current: statusMetrics.failed,
      baseline: 0,
      delta: statusMetrics.failed,
      passed: statusMetrics.failed === 0,
    },
    passRate: {
      current: statusMetrics.passRate,
      baseline: expectedPassRate,
      delta:
        typeof expectedPassRate === 'number'
          ? statusMetrics.passRate - expectedPassRate
          : null,
      passed:
        typeof expectedPassRate !== 'number' ||
        statusMetrics.passRate >= expectedPassRate,
    },
  };

  return {
    values,
    durationMs: statusMetrics.durationMs || 0,
    areas: (statusMetrics.areas || []).filter(area => area !== 'Setup'),
    byArea: statusMetrics.byArea || {},
    passed: e2eMetrics.every(metric => values[metric].passed),
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
        max-width: 1080px;
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
        padding: 12px;
        border-bottom: 1px solid var(--border);
        text-align: right;
        white-space: nowrap;
      }
      th:first-child,
      td:first-child {
        text-align: left;
      }
      thead th {
        color: var(--muted);
        font-size: 13px;
        text-transform: uppercase;
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
        display: block;
        font-size: 12px;
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
          <table>
            <thead>
              <tr>
                <th>${renderHelpLabel('Suite', metricHelp.suite)}</th>
                ${metrics
                  .map(
                    metric =>
                      `${renderHeader(metric)}${renderHeader(metric, true)}`,
                  )
                  .join('')}
              </tr>
            </thead>
            <tbody id="coverage-body"></tbody>
          </table>
        </div>
      </section>

      <section>
        <div class="section-body">
          <strong>Test reports</strong>
          <p>Recorded non-coverage test suite results.</p>
        </div>
        <div class="table-wrap">
          <table class="test-report-table">
            <thead>
              <tr>
                <th>Test suite</th>
                <th>Status</th>
                <th>Details</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody id="test-report-body"></tbody>
          </table>
        </div>
      </section>

      <section id="e2e-metrics-section" hidden>
        <div class="section-body">
          <strong>End-to-end metrics</strong>
          <p>Playwright test counts and pass rate compared to the checked-in baseline.</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Current</th>
                <th>Baseline</th>
              </tr>
            </thead>
            <tbody id="e2e-metrics-body"></tbody>
          </table>
        </div>
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
            ${escapeHtml(metadata.generatedAt)}
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
      var e2eMetrics = ${JSON.stringify(e2eMetrics)};
      var e2eMetricLabels = ${JSON.stringify(e2eMetricLabels)};

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

      function formatE2eMetricValue(metric, value) {
        if (typeof value !== 'number') {
          return 'n/a';
        }

        if (metric === 'passRate') {
          return value.toFixed(2) + '%';
        }

        return String(value);
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
              '<td class="' + className + '">' +
                escapeHtml(formatPercent(values.current)) +
                '<span class="delta ' + deltaClass + '">' +
                  escapeHtml(formatDelta(values.delta)) +
                '</span>' +
              '</td>' +
              '<td class="baseline">' + escapeHtml(formatPercent(values.baseline)) + '</td>'
            );
          })
          .join('');
      }

      function renderCoverageTable(lanes) {
        var rows = lanes
          .filter(function (lane) {
            return lane.kind === 'coverage';
          })
          .map(function (lane) {
            return (
            '<tr>' +
                '<td>' +
                  '<strong>' + escapeHtml(lane.label) + '</strong>' +
                  (lane.stale ? '<span class="subtle">Showing previous run</span>' : '') +
                '</td>' +
                renderMetricCells(lane) +
              '</tr>'
            );
          })
          .join('');
        document.getElementById('coverage-body').innerHTML = rows;
      }

      function renderTestReports(lanes) {
        var rows = lanes
          .filter(function (lane) {
            return lane.kind === 'test';
          })
          .map(function (lane) {
            var report = lane.localReportHref
              ? '<a href="' + escapeHtml(lane.localReportHref) + '">Open HTML report</a>'
              : '<span class="subtle">' + escapeHtml(lane.command) + '</span>';
            return (
              '<tr>' +
                '<td>' +
                  '<strong>' + escapeHtml(lane.label) + '</strong>' +
                  '<span class="subtle">' + escapeHtml(lane.description || '') + '</span>' +
                '</td>' +
                '<td class="' + statusClass(lane.status) + '">' +
                  escapeHtml(statusLabel(lane.status)) +
                  (lane.previousStatus
                    ? '<span class="subtle">Previous: ' +
                        escapeHtml(statusLabel(lane.previousStatus)) +
                      '</span>'
                    : '') +
                '</td>' +
                '<td>' +
                  escapeHtml(lane.message) +
                  (lane.e2eMetrics
                    ? '<span class="subtle">Duration ' +
                        escapeHtml(formatDuration(lane.e2eMetrics.durationMs)) +
                        (lane.e2eMetrics.areas.length
                          ? ' · Areas: ' + escapeHtml(lane.e2eMetrics.areas.join(', '))
                          : '') +
                      '</span>'
                    : '') +
                  '<span class="subtle">Recorded ' + escapeHtml(lane.generatedAt) + '</span>' +
                '</td>' +
                '<td>' + report + '</td>' +
              '</tr>'
            );
          })
          .join('');
        document.getElementById('test-report-body').innerHTML = rows;
      }

      function renderE2eMetrics(lanes) {
        var lane = lanes.find(function (item) {
          return item.name === 'e2e';
        });
        var section = document.getElementById('e2e-metrics-section');
        var body = document.getElementById('e2e-metrics-body');
        var areaMetrics = document.getElementById('e2e-area-metrics');

        if (!lane || !lane.e2eMetrics || lane.status === 'skipped') {
          section.hidden = true;
          return;
        }

        section.hidden = false;
        body.innerHTML = e2eMetrics
          .map(function (metric) {
            var values = lane.e2eMetrics.values[metric] || {};
            var className = values.passed ? 'pass' : 'fail';
            var deltaClass =
              typeof values.delta === 'number' && values.delta >= 0 ? 'pass' : 'fail';
            return (
              '<tr>' +
                '<td><strong>' + escapeHtml(e2eMetricLabels[metric] || metric) + '</strong></td>' +
                '<td class="' + className + '">' +
                  escapeHtml(formatE2eMetricValue(metric, values.current)) +
                  (typeof values.delta === 'number'
                    ? '<span class="delta ' + deltaClass + '">' +
                        escapeHtml(formatDelta(values.delta)) +
                      '</span>'
                    : '') +
                '</td>' +
                '<td class="baseline">' +
                  escapeHtml(formatE2eMetricValue(metric, values.baseline)) +
                '</td>' +
              '</tr>'
            );
          })
          .join('') +
          '<tr>' +
            '<td><strong>Duration</strong></td>' +
            '<td colspan="2">' + escapeHtml(formatDuration(lane.e2eMetrics.durationMs)) + '</td>' +
          '</tr>';

        var areaRows = Object.keys(lane.e2eMetrics.byArea || {})
          .filter(function (area) {
            return area !== 'Setup';
          })
          .sort()
          .map(function (area) {
            var areaValues = lane.e2eMetrics.byArea[area];
            return (
              '<tr>' +
                '<td><strong>' + escapeHtml(area) + '</strong></td>' +
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
          '<strong>Coverage by area</strong>' +
          '<div class="table-wrap">' +
            '<table class="test-report-table">' +
              '<thead><tr><th>Area</th><th>Passed</th><th>Failed</th><th>Total</th></tr></thead>' +
              '<tbody>' + areaRows + '</tbody>' +
            '</table>' +
          '</div>';
      }

      function failedMetrics(lanes) {
        return lanes
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
                };
              });
          });
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
              formatPercent(failure.values.current) +
              ', below baseline ' +
              formatPercent(failure.values.baseline) +
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
        renderCoverageTable(lanes);
        renderTestReports(lanes);
        renderE2eMetrics(lanes);
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
