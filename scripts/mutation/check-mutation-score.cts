#!/usr/bin/env node

// Checks Stryker mutation scores against the floors in
// tooling/baselines/mutation.json. The score is Stryker's: detected mutants
// (killed or timed out) over every valid mutant (detected, survived or not
// covered). Static and ignored mutants and compile errors don't count.
//
//   node scripts/mutation/check-mutation-score.cts [--scope=server] [--report=path]
//   node scripts/mutation/check-mutation-score.cts --summary   (prints counts only)

const fs = require('fs') as typeof import('node:fs');
const path = require('path') as typeof import('node:path');

type Suite = 'client' | 'server' | 'nostranslation';
type Status =
  | 'Killed'
  | 'Survived'
  | 'NoCoverage'
  | 'Timeout'
  | 'CompileError'
  | 'RuntimeError'
  | 'Ignored'
  | 'Pending';
interface MutationReport {
  files: Record<string, { mutants: Array<{ status: Status }> }>;
}
type Counts = Record<Status, number>;

const root = path.resolve(__dirname, '../..');
const baselinePath = path.join(root, 'tooling/baselines/mutation.json');
const suites: Suite[] = ['server', 'client', 'nostranslation'];

const args = process.argv.slice(2);
const option = (name: string): string | undefined =>
  args.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1];
const scope = option('scope');
const reportOverride = option('report');
const summaryOnly = args.includes('--summary');

function isSuite(value: string): value is Suite {
  return (suites as string[]).includes(value);
}
if (scope && !isSuite(scope)) {
  console.error(`Unknown mutation scope "${scope}".`);
  process.exit(1);
}
if (reportOverride && !scope) {
  console.error('--report needs --scope.');
  process.exit(1);
}

function count(report: MutationReport): Counts {
  const counts = {
    Killed: 0,
    Survived: 0,
    NoCoverage: 0,
    Timeout: 0,
    CompileError: 0,
    RuntimeError: 0,
    Ignored: 0,
    Pending: 0,
  };
  for (const file of Object.values(report.files)) {
    for (const mutant of file.mutants) counts[mutant.status] += 1;
  }
  return counts;
}

function score(counts: Counts): number {
  const detected = counts.Killed + counts.Timeout;
  const valid = detected + counts.Survived + counts.NoCoverage;
  return valid === 0 ? 100 : (detected / valid) * 100;
}

const floors = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Record<
  Suite,
  number
>;
const selected = scope && isSuite(scope) ? [scope] : suites;
const failures: string[] = [];
for (const suite of selected) {
  const reportPath = path.resolve(
    root,
    reportOverride ?? `reports/stryker/${suite}.json`,
  );
  if (!fs.existsSync(reportPath)) {
    failures.push(
      `${suite}: no Stryker report at ${path.relative(root, reportPath)}; run pnpm run test:mutation:${suite}`,
    );
    continue;
  }
  const counts = count(
    JSON.parse(fs.readFileSync(reportPath, 'utf8')) as MutationReport,
  );
  const value = score(counts);
  const line = `${suite} mutation score ${value.toFixed(2)}% (killed ${counts.Killed}, timeout ${counts.Timeout}, survived ${counts.Survived}, no coverage ${counts.NoCoverage}, ignored ${counts.Ignored})`;
  if (summaryOnly) {
    console.log(line);
  } else if (value < floors[suite]) {
    failures.push(`${line} is below the floor of ${floors[suite]}%`);
  } else {
    console.log(`${line} passed the floor of ${floors[suite]}%`);
  }
}

if (failures.length > 0) {
  console.error('Mutation score check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
