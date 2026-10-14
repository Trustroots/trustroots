const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  duration,
  formatDuration,
  readTimings,
  renderTimings,
} = require('../../../../../scripts/coverage/ci-timings');
const {
  collectTimings,
} = require('../../../../../scripts/coverage/collect-ci-timings');
const {
  buildMarkdown,
} = require('../../../../../scripts/coverage/generate-pr-summary');

describe('CI timing overview', () => {
  const startedAt = '2026-01-01T00:00:00Z';
  const completedAt = '2026-01-01T00:01:00Z';
  const job = {
    name: 'client <checks>',
    status: 'completed',
    conclusion: 'success',
    started_at: startedAt,
    completed_at: completedAt,
    html_url: 'https://github.com/example/project/actions/runs/1/job/2',
    steps: [
      {
        name: 'Test "client"',
        number: 1,
        status: 'completed',
        conclusion: 'success',
        started_at: startedAt,
        completed_at: completedAt,
      },
      {
        name: 'Skipped',
        number: 2,
        status: 'completed',
        conclusion: 'skipped',
        started_at: startedAt,
        completed_at: startedAt,
      },
    ],
  };
  const timings = {
    collectedAt: completedAt,
    workflows: [
      {
        name: 'Tests',
        url: 'https://github.com/example/project/actions/runs/1',
        startedAt,
        jobs: [job, { ...job, name: 'server' }],
      },
    ],
    unavailable: ['Linter'],
  };

  it('distinguishes elapsed time from parallel job time and links every step', () => {
    const html = renderTimings(timings);
    assert.ok(html.includes('Elapsed to snapshot: 1m 00s'));
    assert.ok(html.includes('Accumulated completed job time: 2m 00s'));
    assert.ok(html.includes('2/2 jobs completed'));
    assert.ok(html.includes('#step:1:1'));
    assert.ok(html.includes(' (slowest)'));
    assert.ok(html.includes('client &lt;checks&gt;'));
    assert.ok(html.includes('Test &quot;client&quot;'));
    assert.ok(html.includes('Linter timings unavailable'));
    assert.ok(html.includes('<td>skipped</td><td>n/a</td>'));
  });

  it('shows running jobs and missing timestamps without invented durations', () => {
    const html = renderTimings({
      ...timings,
      unavailable: undefined,
      workflows: [
        {
          ...timings.workflows[0],
          jobs: [
            {
              ...job,
              status: 'in_progress',
              conclusion: null,
              completed_at: null,
              steps: [
                { ...job.steps[0], status: 'in_progress', conclusion: null },
              ],
            },
          ],
        },
      ],
    });
    assert.ok(html.includes('in_progress — n/a'));
    assert.ok(html.includes('0/1 jobs completed'));
    assert.ok(html.includes('<td>in_progress</td><td>n/a</td>'));
    assert.equal(duration(startedAt, null), null);
    assert.equal(duration('invalid', completedAt), null);
    assert.equal(duration(completedAt, startedAt), null);
    assert.equal(duration(startedAt, startedAt), 0);
    assert.equal(formatDuration(null), 'n/a');
  });

  it('renders unavailable data and completed jobs without any steps', () => {
    assert.ok(renderTimings(null).includes('unavailable'));
    assert.ok(renderTimings({ workflows: [] }).includes('unavailable'));
    const html = renderTimings({
      ...timings,
      workflows: [
        {
          ...timings.workflows[0],
          jobs: [{ ...job, started_at: null, steps: [] }],
        },
      ],
    });
    assert.ok(html.includes('success — n/a'));
    assert.ok(!html.includes('(slowest)'));
  });

  it('includes timings in both coverage and documentation PR summaries', () => {
    assert.ok(
      buildMarkdown([], { timings }).includes('Accumulated completed job time'),
    );
    assert.ok(
      buildMarkdown([], {
        timings,
        includeCoverage: false,
        lineChanges: { groups: [], binaryFiles: 0 },
      }).includes('CI timings'),
    );
  });

  it('reads an optional timing snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-timings-'));
    try {
      assert.equal(readTimings(root), null);
      fs.mkdirSync(path.join(root, 'coverage'));
      fs.writeFileSync(
        path.join(root, 'coverage/ci-timings.json'),
        JSON.stringify(timings),
      );
      assert.deepEqual(readTimings(root), timings);
      fs.writeFileSync(path.join(root, 'coverage/ci-timings.json'), '{');
      assert.equal(readTimings(root), null);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses a completed workflow duration rather than the later snapshot time', () => {
    const html = renderTimings({
      ...timings,
      collectedAt: '2026-01-01T00:05:00Z',
      workflows: [{ ...timings.workflows[0], completedAt }],
    });
    assert.ok(html.includes('Elapsed: 1m 00s'));
    assert.ok(!html.includes('Elapsed to snapshot'));
  });

  function api({
    failRun = false,
    failJobs = false,
    failLint = false,
    runs = [],
  } = {}) {
    const calls = [];
    const actions = {
      getWorkflowRun: async () => {
        if (failRun) throw new Error('API unavailable');
        return {
          data: {
            id: 1,
            run_attempt: 1,
            run_started_at: startedAt,
            html_url: 'https://github.com/example/project/actions/runs/1',
          },
        };
      },
      listJobsForWorkflowRunAttempt: 'jobs',
      listWorkflowRuns: 'runs',
    };
    return {
      calls,
      rest: { actions },
      paginate: async (method, args) => {
        calls.push({ method, args });
        if (method === 'jobs') {
          if (failJobs) throw new Error('Jobs unavailable');
          return [job];
        }
        if (failLint) throw new Error('Lint unavailable');
        return runs;
      },
    };
  }
  const context = {
    repo: { owner: 'example', repo: 'project' },
    runId: 1,
    payload: {},
  };
  const prContext = {
    ...context,
    payload: { pull_request: { number: 3, head: { sha: 'a'.repeat(40) } } },
  };

  it('collects the current attempt and most recent matching PR lint run', async () => {
    const run = {
      id: 2,
      run_attempt: 4,
      status: 'completed',
      updated_at: completedAt,
      run_started_at: startedAt,
      html_url: 'https://github.com/example/project/actions/runs/2',
      pull_requests: [{ number: 3 }],
    };
    const github = api({
      runs: [
        run,
        { ...run, id: 5 },
        { ...run, id: 6, pull_requests: [{ number: 7 }] },
      ],
    });
    const result = await collectTimings(github, prContext, 2);
    assert.deepEqual(
      result.workflows.map(workflow => workflow.name),
      ['Tests', 'Linter'],
    );
    assert.deepEqual(result.unavailable, []);
    assert.equal(github.calls[0].args.attempt_number, 2);
    assert.equal(github.calls[1].args.head_sha, 'a'.repeat(40));
    assert.equal(github.calls[2].args.run_id, 5);
    assert.equal(github.calls[2].args.attempt_number, 4);
    assert.equal(result.workflows[1].completedAt, completedAt);
  });

  it('keeps reporting usable when APIs fail or no matching lint run exists', async () => {
    const missing = await collectTimings(api(), prContext, 1);
    assert.deepEqual(missing.unavailable, ['Linter']);
    const failed = await collectTimings(
      api({ failJobs: true, failLint: true }),
      prContext,
      1,
    );
    assert.deepEqual(failed.unavailable, ['Tests', 'Linter']);
    const failedRun = await collectTimings(api({ failRun: true }), context, 1);
    assert.deepEqual(failedRun.unavailable, ['Tests']);
    const push = await collectTimings(api(), context, 1);
    assert.equal(push.workflows.length, 1);
    assert.deepEqual(push.unavailable, []);
  });
});
