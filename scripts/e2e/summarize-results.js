#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { areaForSpec, computeAreaCoverage } = require('./areas');
const { summarizeFeatureCoverage } = require('./feature-coverage-summary');
const { mergeRawCoverage } = require('./merge-js-coverage');

const root = path.resolve(__dirname, '../..');
const resultsPath = path.join(root, 'coverage/e2e/playwright-results.json');
const statusPath = path.join(root, 'coverage/e2e/status.json');
const enforceFeatureCoverage =
  process.env.TRUSTROOTS_E2E_ENFORCE_FEATURE_COVERAGE === 'true';

const TERMINAL_FAILURES = new Set([
  'failed',
  'timedOut',
  'interrupted',
  'unexpected',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function summarizeReport(report) {
  const areas = new Set();
  const areaResults = {};
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let durationMs = 0;

  function record(area, status) {
    if (!areaResults[area]) {
      areaResults[area] = { total: 0, passed: 0, failed: 0, skipped: 0 };
    }

    areaResults[area].total += 1;

    if (status === 'passed' || status === 'expected') {
      areaResults[area].passed += 1;
    } else if (TERMINAL_FAILURES.has(status)) {
      areaResults[area].failed += 1;
    } else {
      areaResults[area].skipped += 1;
    }
  }

  function walkSuites(suiteList) {
    for (const suite of suiteList || []) {
      for (const spec of suite.specs || []) {
        const fileName = path.basename(spec.file || '');
        if (fileName === 'auth.setup.js') {
          continue;
        }

        const area = areaForSpec(spec.file);
        areas.add(area);

        for (const testCase of spec.tests || []) {
          total += 1;
          const results = testCase.results || [];
          const lastResult = results[results.length - 1];
          const status = lastResult ? lastResult.status : 'skipped';

          for (const result of results) {
            if (typeof result.duration === 'number') {
              durationMs += result.duration;
            }
          }

          if (status === 'passed' || status === 'expected') {
            passed += 1;
          } else if (TERMINAL_FAILURES.has(status)) {
            failed += 1;
          } else {
            skipped += 1;
          }

          record(area, status);
        }
      }

      walkSuites(suite.suites);
    }
  }

  walkSuites(report.suites);

  const areaCoverage = computeAreaCoverage(areaResults);
  const featureCoverage = summarizeFeatureCoverage(report);
  if (featureCoverage.validationErrors.length > 0) {
    throw new Error(
      [
        'Feature coverage manifest is invalid:',
        ...featureCoverage.validationErrors.map(error => `- ${error}`),
      ].join('\n'),
    );
  }

  return {
    total,
    passed,
    failed,
    skipped,
    passRate: total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0,
    durationMs,
    areas: Array.from(areas).filter(area => area !== 'Setup').sort(),
    areaCount: areas.size,
    byArea: areaResults,
    areaCoverage: areaCoverage.areaCoverage,
    areaPassCoverage: areaCoverage.areaPassCoverage,
    definedAreaCount: areaCoverage.defined,
    exercisedAreaCount: areaCoverage.exercised,
    greenAreaCount: areaCoverage.green,
    featureCoverage: featureCoverage.featureCoverage,
    featurePassCoverage: featureCoverage.featurePassCoverage,
    scenarioCoverage: featureCoverage.scenarioCoverage,
    activeFeatureCount: featureCoverage.activeFeatureCount,
    coveredFeatureCount: featureCoverage.coveredFeatureCount,
    missingFeatureCount: featureCoverage.missingFeatureCount,
    excludedFeatureCount: featureCoverage.excludedFeatureCount,
    touchedFeatureCount: featureCoverage.touchedFeatureCount,
    greenFeatureCount: featureCoverage.greenFeatureCount,
    requiredScenarioCount: featureCoverage.requiredScenarioCount,
    coveredScenarioCount: featureCoverage.coveredScenarioCount,
    missingScenarioCount: featureCoverage.missingScenarioCount,
    missingByArea: featureCoverage.missingByArea,
    featureDetails: featureCoverage.features,
    excludedFeatures: featureCoverage.excludedFeatures,
  };
}

function readCodeCoverageSummary() {
  const summaryPath = path.join(root, 'coverage/e2e/coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  const summary = readJson(summaryPath);
  if (!summary || !summary.total) {
    return null;
  }

  return {
    statements: summary.total.statements.pct,
    branches: summary.total.branches.pct,
    functions: summary.total.functions.pct,
    lines: summary.total.lines.pct,
  };
}

function formatMessage(metrics, fallbackMessage) {
  if (!metrics || metrics.total === 0) {
    return fallbackMessage;
  }

  const parts = [
    `${metrics.passed}/${metrics.total} Playwright tests passed (${metrics.passRate.toFixed(
      2,
    )}%)`,
  ];

  if (typeof metrics.areaCoverage === 'number') {
    parts.push(
      `${metrics.exercisedAreaCount}/${metrics.definedAreaCount} areas exercised (${metrics.areaCoverage.toFixed(
        2,
      )}%)`,
    );
  }

  if (typeof metrics.featureCoverage === 'number') {
    parts.push(
      `${metrics.coveredFeatureCount}/${metrics.activeFeatureCount} features covered (${metrics.featureCoverage.toFixed(
        2,
      )}%)`,
    );
  }

  if (metrics.codeCoverage) {
    parts.push(
      `client code ${metrics.codeCoverage.statements.toFixed(2)}% statements`,
    );
  }

  if (enforceFeatureCoverage && metrics.missingScenarioCount > 0) {
    parts.push(`${metrics.missingScenarioCount} feature scenarios missing`);
  }

  return `${parts.join('; ')}.`;
}

function writeStatus(status, exitCode, message, metrics) {
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(
    statusPath,
    `${JSON.stringify(
      {
        status,
        exitCode: Number(exitCode),
        message: formatMessage(metrics, message),
        generatedAt: new Date().toISOString(),
        command: 'npm run test:e2e',
        reportPath: 'playwright-report/index.html',
        metrics,
      },
      null,
      2,
    )}\n`,
  );
}

async function run() {
  const status = process.env.STATUS || 'unknown';
  const exitCode = Number(process.env.EXIT_CODE || 0);
  const message = process.env.MESSAGE || 'No status message was recorded.';

  await mergeRawCoverage();

  if (!fs.existsSync(resultsPath)) {
    writeStatus(status, exitCode, message, null);
    return;
  }

  const metrics = summarizeReport(readJson(resultsPath));
  const codeCoverage = readCodeCoverageSummary();
  if (codeCoverage) {
    metrics.codeCoverage = codeCoverage;
  }

  writeStatus(status, exitCode, message, metrics);

  if (
    enforceFeatureCoverage &&
    (metrics.missingScenarioCount > 0 || metrics.featurePassCoverage < 100)
  ) {
    throw new Error(
      `End-to-end feature coverage is below 100%: ${metrics.coveredScenarioCount}/${metrics.requiredScenarioCount} scenarios covered.`,
    );
  }
}

run().catch(error => {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`Failed to summarize end-to-end results: ${message}\n`);
  process.exit(1);
});
