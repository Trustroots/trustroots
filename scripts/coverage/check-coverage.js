#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const baselinePath = path.join(root, 'coverage-baseline.json');
const suites = {
  client: path.join(root, 'coverage/client/coverage-summary.json'),
  server: path.join(root, 'coverage/server/coverage-summary.json'),
};
const metrics = ['statements', 'branches', 'functions', 'lines'];

const args = process.argv.slice(2);
const update = args.includes('--update');
const scopeArg = args.find(arg => arg.startsWith('--scope='));
const scope = scopeArg ? scopeArg.split('=')[1] : null;
const suiteNames = scope ? [scope] : Object.keys(suites);

if (scope && !suites[scope]) {
  console.error(`Unknown coverage scope "${scope}".`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readCoverageSummary(suite) {
  const summaryPath = suites[suite];
  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  const summary = readJson(summaryPath);
  return metrics.reduce((result, metric) => {
    result[metric] = summary.total[metric].pct;
    return result;
  }, {});
}

function formatValue(value) {
  return Number(value).toFixed(2);
}

const current = {};
const missing = [];
for (const suite of suiteNames) {
  const summary = readCoverageSummary(suite);
  if (summary) {
    current[suite] = summary;
  } else {
    missing.push({
      suite,
      summaryPath: suites[suite],
    });
  }
}

if (missing.length > 0) {
  console.error('Coverage ratchet could not check every requested suite:');
  for (const item of missing) {
    console.error(
      `- Missing ${item.suite} coverage summary at ${path.relative(
        root,
        item.summaryPath,
      )}.`,
    );
  }
  console.error(
    'Run npm run test:coverage for CI-style coverage, or run the client/server coverage scripts separately when debugging locally.',
  );
  process.exit(1);
}

if (update) {
  const baseline = fs.existsSync(baselinePath)
    ? readJson(baselinePath)
    : {};
  for (const suite of suiteNames) {
    baseline[suite] = current[suite];
  }
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Updated ${path.relative(root, baselinePath)}.`);
  process.exit(0);
}

const baseline = readJson(baselinePath);
const failures = [];

for (const suite of suiteNames) {
  for (const metric of metrics) {
    const expected = baseline[suite][metric];
    const actual = current[suite][metric];
    if (actual < expected) {
      const delta = actual - expected;
      failures.push(
        `${suite} ${metric}: ${formatValue(actual)}% is below baseline ${formatValue(
          expected,
        )}% by ${formatValue(Math.abs(delta))} points`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Coverage ratchet failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

for (const suite of suiteNames) {
  const summary = metrics
    .map(metric => `${metric} ${formatValue(current[suite][metric])}%`)
    .join(', ');
  console.log(`${suite} coverage passed ratchet: ${summary}`);
}
