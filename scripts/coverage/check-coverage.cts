#!/usr/bin/env node

const fs = require('fs') as typeof import('node:fs');
const path = require('path') as typeof import('node:path');

type Suite = 'client' | 'server';
type Metric = 'statements' | 'branches' | 'functions' | 'lines';
type CoverageValues = Record<Metric, number>;
interface CoverageSummaryFile {
  total: Record<Metric, { pct: number }>;
}
type CoverageBaseline = Partial<Record<Suite, CoverageValues>>;

const root = path.resolve(__dirname, '../..');
const baselinePath = path.join(root, 'tooling/baselines/coverage.json');
const suites: Record<Suite, string> = {
  client: path.join(root, 'coverage/client/coverage-summary.json'),
  server: path.join(root, 'coverage/server/coverage-summary.json'),
};
const metrics: Metric[] = ['statements', 'branches', 'functions', 'lines'];

const args = process.argv.slice(2);
const update = args.includes('--update');
const requireFull = args.includes('--require-full');
const scopeArg = args.find((arg: string) => arg.startsWith('--scope='));
const scope = scopeArg ? scopeArg.split('=')[1] : null;
function isSuite(value: string): value is Suite {
  return Object.hasOwn(suites, value);
}

if (scope && !isSuite(scope)) {
  console.error(`Unknown coverage scope "${scope}".`);
  process.exit(1);
}
const suiteNames: Suite[] =
  scope && isSuite(scope) ? [scope] : ['client', 'server'];

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readCoverageSummary(suite: Suite): CoverageValues | null {
  const summaryPath = suites[suite];
  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  const summary = readJson<CoverageSummaryFile>(summaryPath);
  return {
    statements: summary.total.statements.pct,
    branches: summary.total.branches.pct,
    functions: summary.total.functions.pct,
    lines: summary.total.lines.pct,
  };
}

function formatValue(value: number): string {
  return Number(value).toFixed(2);
}

const current: Partial<Record<Suite, CoverageValues>> = {};
const missing: Array<{ suite: Suite; summaryPath: string }> = [];
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
    'Run pnpm run test:coverage for CI-style coverage, or run the client/server coverage scripts separately when debugging locally.',
  );
  process.exit(1);
}

if (update) {
  const baseline: CoverageBaseline = fs.existsSync(baselinePath)
    ? readJson<CoverageBaseline>(baselinePath)
    : {};
  for (const suite of suiteNames) {
    baseline[suite] = current[suite]!;
  }
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Updated ${path.relative(root, baselinePath)}.`);
  process.exit(0);
}

const baseline = readJson<CoverageBaseline>(baselinePath);
const failures: string[] = [];

for (const suite of suiteNames) {
  for (const metric of metrics) {
    const expected = requireFull ? 100 : baseline[suite]![metric];
    const actual = current[suite]![metric];
    if (actual < expected) {
      const delta = actual - expected;
      const expectation = requireFull
        ? 'required 100.00%'
        : `baseline ${formatValue(expected)}%`;
      failures.push(
        `${suite} ${metric}: ${formatValue(
          actual,
        )}% is below ${expectation} by ${formatValue(Math.abs(delta))} points`,
      );
    }
  }
}

if (failures.length > 0) {
  const check = requireFull ? 'requirement' : 'ratchet';
  console.error(`Coverage ${check} failed:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

for (const suite of suiteNames) {
  const summary = metrics
    .map(metric => `${metric} ${formatValue(current[suite]![metric])}%`)
    .join(', ');
  const check = requireFull ? '100% requirement' : 'ratchet';
  console.log(`${suite} coverage passed ${check}: ${summary}`);
}
