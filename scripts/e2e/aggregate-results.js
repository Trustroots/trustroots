#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { GROUPS } = require('./groups');
const {
  summarizeReport,
  featureCoverageIncomplete,
} = require('./summarize-results');

const root = path.resolve(__dirname, '../..');

function aggregateReports(entries, jobResult = 'success') {
  const report = { suites: [], errors: [] };
  const problems = [];
  if (jobResult !== 'success') {
    problems.push(`E2E group jobs did not succeed: ${jobResult}.`);
  }
  const seen = new Set();

  for (const group of Object.keys(GROUPS)) {
    try {
      const entry = entries[group];
      if (!entry || !entry.status || !entry.report) {
        throw new Error('missing status or results');
      }
      if (entry.status.status !== 'passed' || entry.status.exitCode !== 0) {
        problems.push(`${group}: ${entry.status.message || 'group failed'}`);
      }
      if (
        !Array.isArray(entry.report.suites) ||
        !Array.isArray(entry.report.errors)
      ) {
        throw new Error('malformed results');
      }
      let productTests = 0;
      const groupKeys = new Set();
      const validate = (suites, titles = []) => {
        for (const suite of suites) {
          if (
            !Array.isArray(suite.specs) ||
            (suite.suites !== undefined && !Array.isArray(suite.suites))
          ) {
            throw new Error('malformed suite');
          }
          for (const spec of suite.specs) {
            if (!spec.file || !spec.title || !Array.isArray(spec.tests)) {
              throw new Error('malformed spec');
            }
            for (const test of spec.tests) {
              if (
                !Array.isArray(test.results) ||
                test.results.length === 0 ||
                test.results.some(
                  result =>
                    ![
                      'passed',
                      'failed',
                      'timedOut',
                      'skipped',
                      'interrupted',
                    ].includes(result.status),
                )
              ) {
                throw new Error('malformed test results');
              }
              if (test.projectName === 'setup-authenticated') continue;
              if (!GROUPS[group].includes(test.projectName)) {
                throw new Error(`unexpected project ${test.projectName}`);
              }
              const key = JSON.stringify([
                test.projectName,
                spec.file,
                ...titles,
                suite.title,
                spec.title,
                spec.line,
                spec.column,
              ]);
              if (seen.has(key) || groupKeys.has(key))
                throw new Error(`duplicate product test ${spec.title}`);
              groupKeys.add(key);
              productTests += 1;
            }
          }
          validate(suite.suites || [], [...titles, suite.title]);
        }
      };
      validate(entry.report.suites);
      if (!productTests) throw new Error('no product tests');
      for (const key of groupKeys) seen.add(key);
      report.suites.push(...entry.report.suites);
      report.errors.push(...entry.report.errors);
    } catch (error) {
      problems.push(`${group}: ${error.message}`);
    }
  }

  const metrics = summarizeReport(report);
  if (report.errors.length || metrics.failed || metrics.skipped) {
    problems.push('Some tests failed, were skipped or could not run.');
  }
  if (featureCoverageIncomplete(metrics)) {
    problems.push(
      `Incomplete feature coverage: ${metrics.coveredScenarioCount}/${metrics.requiredScenarioCount} scenarios.`,
    );
  }
  return {
    report,
    status: {
      status: problems.length ? 'failed' : 'passed',
      exitCode: problems.length ? 1 : 0,
      message: problems.length
        ? problems.join(' ')
        : 'All three e2e groups passed with complete feature coverage.',
      generatedAt: new Date().toISOString(),
      command: 'npm run test:e2e (three CI groups)',
      reportPath: 'playwright-report/index.html',
      metrics,
    },
  };
}

function run() {
  const entries = {};
  for (const group of Object.keys(GROUPS)) {
    const directory = path.join(
      root,
      'coverage/e2e/groups',
      `coverage-e2e-${group}`,
    );
    try {
      entries[group] = {
        status: JSON.parse(
          fs.readFileSync(path.join(directory, 'status.json'), 'utf8'),
        ),
        report: JSON.parse(
          fs.readFileSync(
            path.join(directory, 'playwright-results.json'),
            'utf8',
          ),
        ),
      };
    } catch (error) {
      entries[group] = null;
    }
  }
  const result = aggregateReports(
    entries,
    process.env.TRUSTROOTS_E2E_GROUP_JOB_RESULT || 'success',
  );
  fs.mkdirSync(path.join(root, 'coverage/e2e'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'coverage/e2e/playwright-results.json'),
    `${JSON.stringify(result.report)}\n`,
  );
  fs.writeFileSync(
    path.join(root, 'coverage/e2e/status.json'),
    `${JSON.stringify(result.status, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(root, 'playwright-report'), { recursive: true });
  const links = Object.keys(GROUPS)
    .map(
      group =>
        `<li><a href="playwright-report-${group}/index.html">${group}</a></li>`,
    )
    .join('');
  fs.writeFileSync(
    path.join(root, 'playwright-report/index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>E2E reports</title><h1>E2E reports</h1><ul>${links}</ul></html>\n`,
  );
  process.stdout.write(`${result.status.message}\n`);
  process.exitCode = result.status.exitCode;
}

if (require.main === module) run();
module.exports = { aggregateReports };
