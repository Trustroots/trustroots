#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outputDir = path.join(root, 'coverage-report');
const outputPath = path.join(outputDir, 'index.html');
const baselinePath = path.join(root, 'coverage-baseline.json');
const analyticsConfigPath = path.join(root, 'docs/_data/analytics.json');
const teamLinksConfigPath = path.join(root, 'docs/_data/team_links.json');
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

function renderAnalyticsScript() {
  const analytics = readJson(analyticsConfigPath);

  return `    <script
      defer
      src="${escapeHtml(analytics.scriptSrc)}"
      data-website-id="${escapeHtml(analytics.websiteId)}"
    ></script>`;
}

function renderTeamHeaderLinks(links) {
  return links
    .map(
      link =>
        `          <a href="${escapeHtml(link.href)}">${escapeHtml(
          link.label,
        )}</a>`,
    )
    .join('\n');
}

function renderTeamFooterLinks(links) {
  return links
    .map(
      link =>
        `            <li><a href="${escapeHtml(link.href)}">${escapeHtml(
          link.label,
        )}</a></li>`,
    )
    .join('\n');
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

function statusDurationMs(status) {
  return status && typeof status.durationMs === 'number'
    ? status.durationMs
    : 0;
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

function encodeGitRef(refName) {
  return String(refName).split('/').map(encodeURIComponent).join('/');
}

function getRepositoryUrl() {
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = process.env.GITHUB_REPOSITORY;

  if (!repository) {
    return null;
  }

  return `${serverUrl}/${repository}`;
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
  const repositoryUrl = getRepositoryUrl();
  const branch =
    process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || 'local';
  const commit = process.env.GITHUB_SHA || 'local';
  const generatedAt = new Date().toISOString();
  return {
    branch,
    branchUrl:
      repositoryUrl && branch !== 'local'
        ? `${repositoryUrl}/tree/${encodeGitRef(branch)}`
        : null,
    commit,
    commitUrl:
      repositoryUrl && commit !== 'local'
        ? `${repositoryUrl}/commit/${commit}`
        : null,
    generatedAt,
    generatedAtDisplay: formatDatetime(generatedAt),
    isGitHubActions: process.env.GITHUB_ACTIONS === 'true',
    repositoryUrl,
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
    const bundledReport = path.join(
      outputDir,
      'playwright-report',
      'index.html',
    );
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
    reportGeneratedAt: metadata.generatedAt,
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
      durationMs: statusDurationMs(status),
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
  const metricsPassed = metrics.every(metric => metricValues[metric].passed);
  const statusValue = status ? normalizeStatus(status.status) : null;
  const laneStatus =
    statusValue && statusValue !== 'passed'
      ? statusValue
      : metricsPassed
        ? 'passed'
        : 'failed';
  const generatedAt =
    (status && status.generatedAt) ||
    fileGeneratedAt(suite.summaryPath) ||
    metadata.generatedAt;

  return {
    ...baseLane(suite, metadata),
    status: laneStatus,
    message:
      statusValue && statusValue !== 'passed'
        ? status.message || `${suite.label} coverage failed.`
        : metricsPassed
          ? `${suite.label} coverage meets the checked-in minimum.`
          : `${suite.label} coverage is below the checked-in minimum.`,
    generatedAt,
    durationMs: statusDurationMs(status),
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
  const featureValues = {
    featureCoverage: buildMetricComparison(
      statusMetrics.featureCoverage,
      baseline.featureCoverage,
    ),
    featurePassCoverage: buildMetricComparison(
      statusMetrics.featurePassCoverage,
      baseline.featurePassCoverage,
    ),
    scenarioCoverage: buildMetricComparison(
      statusMetrics.scenarioCoverage,
      baseline.scenarioCoverage,
    ),
  };
  const codeCoverage = buildE2eCodeCoverage(statusMetrics, baseline);
  const codePassed =
    !codeCoverage ||
    metrics.every(
      metric => !codeCoverage[metric] || codeCoverage[metric].passed,
    );

  return {
    testValues,
    areaValues,
    featureValues,
    codeCoverage,
    durationMs: statusMetrics.durationMs || 0,
    areas: (statusMetrics.areas || []).filter(area => area !== 'Setup'),
    byArea: statusMetrics.byArea || {},
    definedAreaCount: statusMetrics.definedAreaCount || 0,
    exercisedAreaCount: statusMetrics.exercisedAreaCount || 0,
    greenAreaCount: statusMetrics.greenAreaCount || 0,
    activeFeatureCount: statusMetrics.activeFeatureCount || 0,
    coveredFeatureCount: statusMetrics.coveredFeatureCount || 0,
    missingFeatureCount: statusMetrics.missingFeatureCount || 0,
    excludedFeatureCount: statusMetrics.excludedFeatureCount || 0,
    touchedFeatureCount: statusMetrics.touchedFeatureCount || 0,
    greenFeatureCount: statusMetrics.greenFeatureCount || 0,
    requiredScenarioCount: statusMetrics.requiredScenarioCount || 0,
    coveredScenarioCount: statusMetrics.coveredScenarioCount || 0,
    missingScenarioCount: statusMetrics.missingScenarioCount || 0,
    missingByArea: statusMetrics.missingByArea || {},
    featureDetails: statusMetrics.featureDetails || [],
    excludedFeatures: statusMetrics.excludedFeatures || [],
    passed:
      e2eTestMetrics.every(metric => testValues[metric].passed) &&
      Object.keys(areaValues).every(metric => areaValues[metric].passed) &&
      Object.keys(featureValues).every(
        metric => featureValues[metric].passed,
      ) &&
      codePassed,
  };
}

function resolveE2eLaneStatus(statusValue, e2eMetrics) {
  if (statusValue && statusValue !== 'passed') {
    return statusValue;
  }

  if (e2eMetrics && e2eMetrics.passed === false) {
    return 'failed';
  }

  return statusValue || 'unknown';
}

function resolveE2eLaneMessage(statusValue, e2eMetrics, fallbackMessage) {
  if (
    statusValue === 'passed' &&
    e2eMetrics &&
    e2eMetrics.passed === false
  ) {
    if (e2eMetrics.missingScenarioCount > 0) {
      return `End-to-end feature coverage is below 100%: ${e2eMetrics.coveredScenarioCount}/${e2eMetrics.requiredScenarioCount} scenarios covered.`;
    }

    return 'End-to-end coverage metrics are below the checked-in baseline.';
  }

  return fallbackMessage || 'No status message was recorded.';
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
  const statusValue = normalizeStatus(status.status);

  return {
    ...lane,
    status: resolveE2eLaneStatus(statusValue, e2eMetricValues),
    message: resolveE2eLaneMessage(
      statusValue,
      e2eMetricValues,
      status.message,
    ),
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
      <span class="help-tooltip" role="tooltip">${text}</span>
    </span>
  `;
}

function capitalizeMetric(metric) {
  return metric.charAt(0).toUpperCase() + metric.slice(1);
}

function renderSuiteTableHead() {
  return `
    <tr>
      <th>${renderHelpLabel('Suite', metricHelp.suite)}</th>
      <th>Status</th>
      <th>${renderHelpLabel(
        'Recorded',
        'When this suite last produced the results shown in the row.',
      )}</th>
      <th>${renderHelpLabel(
        'Result',
        'Coverage suites show JavaScript code coverage. End-to-end shows Playwright test, product area, feature, and scenario coverage.',
      )}</th>
      <th>Report</th>
    </tr>
  `;
}

function formatMetadataTimestamp(isoString) {
  if (!isoString) {
    return 'n/a';
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return String(isoString);
  }

  const pad = value => String(value).padStart(2, "0");

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function renderReportShell(metadata, initialLanes) {
  const teamLinks = readJson(teamLinksConfigPath);
  const repositoryHref = teamLinks.repository.href;
  const runLink = metadata.runUrl
    ? `<a href="${escapeHtml(metadata.runUrl)}">GitHub Actions run</a>`
    : 'local run';
  const shortSha =
    metadata.commit === 'local' ? 'local' : metadata.commit.slice(0, 12);
  const branchLink = metadata.branchUrl
    ? `<a href="${escapeHtml(metadata.branchUrl)}">${escapeHtml(
        metadata.branch,
      )}</a>`
    : escapeHtml(metadata.branch);
  const commitLink = metadata.commitUrl
    ? `<a href="${escapeHtml(metadata.commitUrl)}">${escapeHtml(shortSha)}</a>`
    : escapeHtml(shortSha);
  const summaryText = metadata.isGitHubActions
    ? 'Latest main coverage summary generated by GitHub Actions.'
    : 'Coverage summary generated locally from available coverage data.';
  const buildText =
    metadata.commit === 'local'
      ? 'local'
      : `${formatMetadataTimestamp(metadata.generatedAtDisplay)} UTC (${shortSha})`;
  const buildHref = metadata.commitUrl || repositoryHref;
  const workflowHref = `${repositoryHref}/actions/workflows/test.yml`;
  const generatorEditHref = `${repositoryHref}/edit/main/scripts/coverage/generate-report.js`;
  const githubIconLink = `
    <a
      class="github-icon-link"
      href="${escapeHtml(repositoryHref)}"
      aria-label="${escapeHtml(teamLinks.repository.label)}"
    >
      <svg
        class="github-icon"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.36c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
        />
      </svg>
    </a>
  `;
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
    <meta name="theme-color" content="#12b591">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
      href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    >
    <link rel="stylesheet" href="/assets/css/style.css?v=0">
${renderAnalyticsScript()}
    <style>
      :root {
        --pass: #128a78;
        --pass-bg: #e3f3ed;
        --fail: #a6422d;
        --fail-bg: #f9e8e2;
        --warn: #8b5e00;
        --warn-bg: #fff3cf;
        --skip: #58606a;
        --skip-bg: #eef0f2;
        --accent: #128a78;
        --accent-dark: #004b3f;
        --olive: #98ad46;
        --shadow: rgba(0, 75, 63, 0.14);
        --white: #fff;
      }
      .coverage-report-wrap {
        margin-top: 8px;
      }
      .coverage-report-hero {
        display: flex;
        gap: 24px;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 22px;
        padding: 26px 28px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: rgba(255, 253, 244, 0.82);
        box-shadow: 0 18px 42px var(--shadow);
      }
      .coverage-report-hero h1 {
        margin: 0 0 8px;
        max-width: 760px;
      }
      .coverage-report-meta {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        color: var(--muted);
        font-size: 15px;
        font-weight: 700;
      }
      .coverage-report-meta .meta-separator {
        color: rgba(95, 113, 105, 0.5);
      }
      .coverage-report-meta a {
        overflow-wrap: anywhere;
      }
      .status {
        min-width: 160px;
        padding: 12px 16px;
        border: 1px solid;
        border-radius: 6px;
        font-weight: 800;
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
        box-shadow: 0 18px 42px rgba(0, 75, 63, 0.08);
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
      td:nth-child(3),
      th:nth-child(4),
      td:nth-child(4) {
        text-align: left;
      }
      thead th {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
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
      .result-list {
        display: grid;
        grid-template-columns: minmax(9rem, 1fr) max-content;
        gap: 4px 12px;
        align-items: baseline;
        width: min(100%, 340px);
        white-space: normal;
      }
      .result-pill {
        display: contents;
      }
      .result-pill-label {
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
      }
      .result-pill-value {
        color: var(--text);
        font-size: 13px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        justify-self: end;
        line-height: 1.35;
        text-align: right;
      }
      .result-pill.perfect .result-pill-value {
        color: var(--pass);
      }
      .result-pill.fail .result-pill-value {
        color: var(--fail);
      }
      .recorded-value {
        display: inline-flex;
        flex-direction: column;
        align-items: baseline;
        gap: 2px;
      }
      .help-label {
        position: relative;
        display: inline-flex;
        align-items: center;
        border-bottom: 1px dotted rgba(95, 113, 105, 0.75);
        cursor: help;
        outline: none;
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
      td.missing {
        color: var(--muted);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        color: var(--muted);
        font-size: 15px;
        font-weight: 700;
      }
      .meta a {
        overflow-wrap: anywhere;
      }
      .meta-separator {
        color: rgba(95, 113, 105, 0.5);
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
      .artifact-list .artifact {
        white-space: nowrap;
      }
      .feature-list {
        margin: 8px 0 0;
        padding-left: 1.1rem;
      }
      .feature-list li {
        margin-bottom: 4px;
      }
      @media (max-width: 760px) {
        .coverage-report-hero {
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
    <a id="skip-to-content" href="#content">Skip to the content.</a>
    <header class="header" role="banner">
      <div class="header-inner">
        <a
          href="/"
          class="brand"
          aria-label="Team Trustroots home"
        >
          <img
            class="brand-logo brand-logo-full"
            src="/assets/img/horizontal-white.svg"
            alt="Trustroots"
            width="177"
            height="31"
          />
          <img
            class="brand-logo brand-logo-tree"
            src="/assets/img/tree-white.svg"
            alt="Trustroots"
            width="31"
            height="31"
          />
          <span class="brand-team">team</span>
        </a>
        <nav class="hub-nav" aria-label="Site links">
${renderTeamHeaderLinks(teamLinks.header)}
          ${githubIconLink}
        </nav>
      </div>
    </header>
    <main id="content" class="main-content" role="main">
      <section class="coverage-report-hero">
        <div class="coverage-report-wrap">
          <h1>Trustroots Coverage Report</h1>
          <p>${escapeHtml(summaryText)}</p>
          <p class="coverage-report-ci">
            <a href="${escapeHtml(workflowHref)}"
              >GitHub Actions tests</a
            >
          </p>
          <div class="coverage-report-meta">
            ${branchLink}
            <span class="meta-separator" aria-hidden="true">&middot;</span>
            ${commitLink}
            <span class="meta-separator" aria-hidden="true">&middot;</span>
            <span>${escapeHtml(metadata.generatedAtDisplay)}</span>
            <span class="meta-separator" aria-hidden="true">&middot;</span>
            ${runLink}
          </div>
        </div>
        <div id="overall-status" class="status skip">Loading</div>
      </section>

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

      <section id="detailed-reports" hidden>
        <div class="section-body">
          <strong>Detailed reports</strong>
          <p id="detailed-reports-copy"></p>
          <div id="artifact-list" class="artifact-list"></div>
        </div>
      </section>
      <footer class="site-footer" role="contentinfo">
        <div class="site-footer-content">
          <ul class="site-footer-links">
${renderTeamFooterLinks(teamLinks.header)}
          </ul>
          <div class="site-footer-meta">
            <a
              class="site-footer-build"
              href="${escapeHtml(buildHref)}"
              aria-label="Coverage report metadata"
            >
              <svg
                class="github-icon"
                viewBox="0 0 16 16"
                width="16"
                height="16"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.36c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
                />
              </svg>
              <span class="site-footer-build-commit">${buildText}</span>
            </a>
            <small>
              <a
                class="footer-edit"
                href="${escapeHtml(generatorEditHref)}"
                >Edit this page</a
              >
            </small>
          </div>
        </div>
      </footer>
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
          blocked: '✗ Blocked',
          failed: '✗ Failed',
          passed: '✓',
          skipped: 'Skipped',
          unknown: 'Unknown',
        };
        return labels[status] || status;
      }

      function isPerfectValue(value) {
        if (value === '100.00%') {
          return true;
        }

        var ratio = /^(\\d+)\\/(\\d+)$/.exec(value);
        return Boolean(ratio && ratio[1] === ratio[2]);
      }

      function resultPill(label, value, passed) {
        return (
          '<span class="result-pill ' +
          (passed ? 'pass' : 'fail') +
          (isPerfectValue(value) ? ' perfect' : '') +
          '">' +
            '<span class="result-pill-label">' +
              escapeHtml(label) +
            '</span>' +
            '<span class="result-pill-value">' +
              escapeHtml(value) +
            '</span>' +
          '</span>'
        );
      }

      function renderRecordedCell(lane) {
        var durationMs = lane.e2eMetrics
          ? lane.e2eMetrics.durationMs || lane.durationMs
          : lane.durationMs;
        var html =
          '<span class="recorded-value">' +
            '<span class="metric-value">' +
              escapeHtml(formatDatetime(lane.generatedAt)) +
            '</span>';

        if (typeof durationMs === 'number' && durationMs > 0) {
          html +=
            '<span class="suite-note">Duration ' +
              escapeHtml(formatDuration(durationMs)) +
            '</span>';
        }

        html += '</span>';
        return html;
      }

      function renderCoverageResult(lane) {
        if (!lane.metrics || Object.keys(lane.metrics).length === 0) {
          return (
            '<span class="missing">' +
            escapeHtml(lane.message) +
            '</span>'
          );
        }

        var parts = metrics.map(function (metric) {
          var values = lane.metrics[metric] || {};
          return resultPill(
            metric.charAt(0).toUpperCase() + metric.slice(1),
            formatPercent(values.current),
            values.passed,
          );
        });

        return '<span class="result-list">' + parts.join('') + '</span>';
      }

      function renderE2eResult(lane) {
        if (!lane.e2eMetrics) {
          return (
            '<span class="missing">' +
            escapeHtml(
              lane.message || 'End-to-end test data is not available for this run.',
            ) +
            '</span>'
          );
        }

        var testValues = lane.e2eMetrics.testValues || {};
        var areaValues = lane.e2eMetrics.areaValues || {};
        var featureValues = lane.e2eMetrics.featureValues || {};
        var scenarioValues = featureValues.scenarioCoverage || {};
        var parts = [];

        if (testValues.passed && testValues.total) {
          parts.push(
            resultPill(
              'Tests',
              String(testValues.passed.current) +
                '/' +
                String(testValues.total.current),
              testValues.passed.passed && testValues.total.passed,
            ),
          );
        }

        if (testValues.passRate) {
          parts.push(
            resultPill(
              'Pass rate',
              formatE2eMetricValue('passRate', testValues.passRate.current),
              testValues.passRate.passed,
            ),
          );
        }

        if (typeof areaValues.areaCoverage.current === 'number') {
          parts.push(
            resultPill(
              'Areas',
              String(lane.e2eMetrics.exercisedAreaCount) +
                '/' +
                String(lane.e2eMetrics.definedAreaCount),
              areaValues.areaCoverage.passed,
            ),
          );
        }

        if (typeof featureValues.featureCoverage.current === 'number') {
          parts.push(
            resultPill(
              'Features',
              String(lane.e2eMetrics.coveredFeatureCount) +
                '/' +
                String(lane.e2eMetrics.activeFeatureCount),
              featureValues.featureCoverage.passed,
            ),
          );
        }

        if (typeof scenarioValues.current === 'number') {
          parts.push(
            resultPill(
              'Scenarios',
              String(lane.e2eMetrics.coveredScenarioCount) +
                '/' +
                String(lane.e2eMetrics.requiredScenarioCount),
              scenarioValues.passed,
            ),
          );
        }

        if (lane.e2eMetrics.codeCoverage) {
          metrics.forEach(function (metric) {
            var values = lane.e2eMetrics.codeCoverage[metric];
            if (values) {
              parts.push(
                resultPill(
                  'Code ' + metric,
                  formatPercent(values.current),
                  values.passed,
                ),
              );
            }
          });
        }

        return '<span class="result-list">' + parts.join('') + '</span>';
      }

      function renderResultCell(lane) {
        if (lane.kind === 'coverage') {
          return renderCoverageResult(lane);
        }

        return renderE2eResult(lane);
      }

      function renderSuiteTable(lanes) {
        var rows = lanes
          .map(function (lane) {
            return (
              '<tr>' +
                '<td>' + renderSuiteNameCell(lane) + '</td>' +
                '<td>' + renderStatusCell(lane) + '</td>' +
                '<td>' + renderRecordedCell(lane) + '</td>' +
                '<td>' + renderResultCell(lane) + '</td>' +
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

        function formatAreaLabel(area) {
          return area === 'Other' ? 'Other (unmapped specs)' : area;
        }

        if (!lane || !lane.e2eMetrics || lane.status === 'skipped') {
          section.hidden = true;
          return;
        }

        section.hidden = false;

        var areaCoverage = lane.e2eMetrics.areaValues || {};
        var featureCoverage = lane.e2eMetrics.featureValues || {};
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

        if (typeof featureCoverage.featureCoverage.current === 'number') {
          summaryParts.push(
            formatPercent(featureCoverage.featureCoverage.current) +
              ' feature coverage (' +
              String(lane.e2eMetrics.coveredFeatureCount) +
              '/' +
              String(lane.e2eMetrics.activeFeatureCount) +
              ' active features)',
          );
        }

        if (typeof featureCoverage.scenarioCoverage.current === 'number') {
          summaryParts.push(
            formatPercent(featureCoverage.scenarioCoverage.current) +
              ' scenario coverage (' +
              String(lane.e2eMetrics.coveredScenarioCount) +
              '/' +
              String(lane.e2eMetrics.requiredScenarioCount) +
              ' scenarios)',
          );
        }

        var areaTotals = {
          failed: 0,
          passed: 0,
          total: 0,
        };
        var areaRows = Object.keys(lane.e2eMetrics.byArea || {})
          .filter(function (area) {
            return area !== 'Setup';
          })
          .sort()
          .map(function (area) {
            var areaValues = lane.e2eMetrics.byArea[area];
            var areaStatus = 'Skipped';
            var areaClass = 'skip';
            var areaIcon = '';
            areaTotals.passed += areaValues.passed || 0;
            areaTotals.failed += areaValues.failed || 0;
            areaTotals.total += areaValues.total || 0;

            if (areaValues.total > 0) {
              if (areaValues.failed > 0) {
                areaStatus = 'Failing';
                areaClass = 'fail';
                areaIcon = '✗ ';
              } else if (areaValues.passed > 0) {
                areaStatus = '';
                areaClass = 'pass';
                areaIcon = '✓';
              }
            }

            return (
              '<tr>' +
                '<td><strong>' + escapeHtml(formatAreaLabel(area)) + '</strong></td>' +
                '<td class="' + areaClass + '">' +
                  escapeHtml(areaIcon + areaStatus) +
                '</td>' +
                '<td>' + escapeHtml(String(areaValues.passed)) + '</td>' +
                '<td>' + escapeHtml(String(areaValues.failed)) + '</td>' +
                '<td>' + escapeHtml(String(areaValues.total)) + '</td>' +
              '</tr>'
            );
          })
          .join('');
        var missingFeatureRows = [];
        var missingByArea = lane.e2eMetrics.missingByArea || {};
        Object.keys(missingByArea)
          .sort()
          .forEach(function (area) {
            (missingByArea[area] || []).forEach(function (feature) {
              missingFeatureRows.push(
                '<tr>' +
                  '<td><strong>' + escapeHtml(formatAreaLabel(area)) + '</strong></td>' +
                  '<td><code>' + escapeHtml(feature.id) + '</code></td>' +
                  '<td>' +
                    escapeHtml((feature.missingScenarios || []).join('; ')) +
                  '</td>' +
                '</tr>',
              );
            });
          });

        var excludedFeatureSummary = lane.e2eMetrics.excludedFeatures || [];
        var excludedFeatureList = excludedFeatureSummary
          .map(function (feature) {
            var details = [];
            if (feature.area) {
              details.push(formatAreaLabel(feature.area));
            }

            if (feature.exclusionReason) {
              details.push(feature.exclusionReason);
            }

            return (
              '<li>' +
              '<code>' +
              escapeHtml(feature.id) +
              '</code> (' +
              (details.length ? escapeHtml(details.join(' · ')) : 'excluded') +
              ')</li>'
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
              '<tfoot><tr><th>Total</th><th></th><th>' +
                escapeHtml(String(areaTotals.passed)) +
                '</th><th>' +
                escapeHtml(String(areaTotals.failed)) +
                '</th><th>' +
                escapeHtml(String(areaTotals.total)) +
                '</th></tr></tfoot>' +
            '</table>' +
          '</div>' +
          '<strong>Manifest feature coverage</strong>' +
          '<p class="subtle">' +
            escapeHtml(
              String(lane.e2eMetrics.excludedFeatureCount) +
                ' excluded features are documented outside the denominator.',
            ) +
            '</p>' +
          (excludedFeatureList.length
            ? '<ul class="feature-list">' +
              excludedFeatureList +
              '</ul>'
            : '<p class="subtle">This suite currently has no excluded feature list.</p>') +
          '<p class="subtle">' +
            'Manifest features missing scenarios in this run:' +
            '</p>' +
          '<div class="table-wrap">' +
            '<table class="test-report-table">' +
              '<thead><tr><th>Area</th><th>Feature</th><th>Missing scenarios</th></tr></thead>' +
              '<tbody>' +
                (missingFeatureRows.length > 0
                  ? missingFeatureRows.join('')
                  : '<tr><td colspan="3">All active feature scenarios are covered.</td></tr>') +
              '</tbody>' +
            '</table>' +
          '</div>';
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
                href: reportMetadata.runUrl
                  ? reportMetadata.runUrl + '#artifacts'
                  : null,
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

module.exports = {
  buildE2eMetrics,
  renderReportShell,
  renderAnalyticsScript,
  resolveE2eLaneMessage,
  resolveE2eLaneStatus,
};

if (require.main === module) {
  writeReport();
}
