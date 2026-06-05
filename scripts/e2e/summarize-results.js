#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const resultsPath = path.join(root, 'coverage/e2e/playwright-results.json');
const statusPath = path.join(root, 'coverage/e2e/status.json');

const AREA_BY_SPEC = {
  'auth-smoke.spec.js': 'Authentication',
  'authenticated.spec.js': 'Member flows',
  'public-pages.spec.js': 'Public pages',
  'nostr.spec.js': 'Nostr',
  'seeded-content.spec.js': 'Seeded content',
  'messages.spec.js': 'Messages',
  'experiences.spec.js': 'Experiences',
  'admin.spec.js': 'Admin',
  'auth.setup.js': 'Setup',
};

const TERMINAL_FAILURES = new Set([
  'failed',
  'timedOut',
  'interrupted',
  'unexpected',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function areaForSpec(specFile) {
  if (!specFile) {
    return 'Other';
  }

  const fileName = path.basename(specFile);
  return AREA_BY_SPEC[fileName] || 'Other';
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
  };
}

function formatMessage(metrics, fallbackMessage) {
  if (!metrics || metrics.total === 0) {
    return fallbackMessage;
  }

  return `${metrics.passed}/${metrics.total} Playwright tests passed (${metrics.passRate.toFixed(
    2,
  )}%).`;
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

function run() {
  const status = process.env.STATUS || 'unknown';
  const exitCode = Number(process.env.EXIT_CODE || 0);
  const message = process.env.MESSAGE || 'No status message was recorded.';

  if (!fs.existsSync(resultsPath)) {
    writeStatus(status, exitCode, message, null);
    return;
  }

  const metrics = summarizeReport(readJson(resultsPath));
  writeStatus(status, exitCode, message, metrics);
}

run();
