const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const {
  categoryForPath,
  collectLineChanges,
  renderLineChanges,
  summariseNumstat,
  updateLineChangesComment,
} = require('../../../../../scripts/coverage/line-changes');
const {
  buildMarkdown,
  marker,
} = require('../../../../../scripts/coverage/generate-pr-summary');
const {
  backfill,
} = require('../../../../../scripts/coverage/backfill-pr-line-changes');

describe('PR line-change summaries', () => {
  it('separates code, tests, configuration, generated files and lockfiles', () => {
    const examples = {
      'src/view.tsx': 'code',
      'modules/widget/client/style.less': 'code',
      'modules/widget/tests/client/widget.tests.js': 'tests',
      'tests/e2e/fixtures/sample.json': 'tests',
      'src/widget.test.ts': 'tests',
      'src/__mocks__/api.js': 'tests',
      'jest/setup.js': 'tests',
      '.github/workflows/test.yml': 'other',
      'config/runtime.js': 'other',
      'webpack.config.js': 'other',
      '.eslintrc.js': 'other',
      'README.md': 'other',
      'package-lock.json': 'generated',
      'nested/yarn.lock': 'generated',
      'public/dist/app.js': 'generated',
      'src/api.generated.ts': 'generated',
      'public/app.min.js': 'generated',
      'public/app.js.map': 'generated',
    };
    for (const [file, expected] of Object.entries(examples)) {
      assert.equal(categoryForPath(file), expected, file);
    }
  });

  it('handles NUL records, renames, binary files and unusual paths', () => {
    const summary = summariseNumstat(
      '2\t10\tsrc/name\twith\nspaces.js\0' +
        '8\t1\t\0src/old.js\0tests/new.spec.js\0' +
        '-\t-\tpublic/sample.png\0' +
        '100\t20\tpackage-lock.json\0',
    );
    assert.deepEqual(
      summary.groups.map(group => [
        group.id,
        group.added,
        group.removed,
        group.net,
      ]),
      [
        ['code', 2, 10, -8],
        ['tests', 8, 1, 7],
        ['other', 0, 0, 0],
        ['generated', 100, 20, 80],
      ],
    );
    assert.equal(summary.binaryFiles, 1);
    assert.match(renderLineChanges(summary), /Binary files changed: 1/);
    assert.throws(() => summariseNumstat('invalid\0'), /Invalid Git numstat/);
    assert.throws(
      () => summariseNumstat('1\t0\t\0old\0'),
      /Missing Git numstat path/,
    );
    assert.throws(() => collectLineChanges('--invalid', 'head'), /commit SHAs/);
  });

  it('shows preferred and opposite directions without treating them as failures', () => {
    const preferred = renderLineChanges(
      summariseNumstat('1\t5\tsrc/app.js\0' + '9\t2\ttests/app.test.js\0'),
    );
    assert.match(preferred, /Application code \| \+1 \| −5 \| 🟢 \*\*−4\*\*/);
    assert.match(
      preferred,
      /Tests and fixtures \| \+9 \| −2 \| 🟢 \*\*\+7\*\*/,
    );
    assert.match(
      preferred,
      /Docs, configuration and other \| 0 \| 0 \| ⚪ \*\*0\*\*/,
    );
    const opposite = renderLineChanges(
      summariseNumstat('5\t1\tsrc/app.js\0' + '2\t9\ttests/app.test.js\0'),
    );
    assert.match(opposite, /🟡 \*\*\+4\*\*/);
    assert.match(opposite, /🟡 \*\*−7\*\*/);
    assert.match(opposite, /do not affect CI success/);
  });

  it('retains coverage content when inserting and refreshing a line table', () => {
    const original = `${marker}\n## Coverage overview\nCoverage: 100%\n`;
    const first = updateLineChangesComment(
      original,
      summariseNumstat('4\t0\ttests/app.js\0'),
    );
    const second = updateLineChangesComment(
      first,
      summariseNumstat('0\t2\tsrc/app.js\0'),
    );
    assert.match(second, /Coverage: 100%/);
    assert.equal(second.split('### Line changes').length, 2);
    assert.match(second, /🟢 \*\*−2\*\*/);
    const coverage = buildMarkdown(
      [{ name: 'client', kind: 'coverage', status: 'passed' }],
      { lineChanges: summariseNumstat('') },
    );
    assert.match(coverage, /Coverage overview/);
    assert.match(coverage, /### Line changes/);
    const docsOnly = buildMarkdown([], {
      includeCoverage: false,
      lineChanges: summariseNumstat('3\t0\tREADME.md\0'),
    });
    assert.match(docsOnly, /Docs, configuration and other \| \+3/);
    assert.doesNotMatch(docsOnly, /Coverage overview|Status: \*\*Passing/);
  });

  it('uses the merge base in a real Git diff rather than counting new base-branch work', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fictional-pr-lines-'));
    const git = args =>
      execFileSync('git', args, {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    const commit = message =>
      git([
        '-c',
        'user.name=Fixture Member',
        '-c',
        'user.email=fixture@example.test',
        'commit',
        '-am',
        message,
      ]);
    try {
      git(['init', '-b', 'main']);
      fs.mkdirSync(path.join(dir, 'src'));
      fs.writeFileSync(
        path.join(dir, 'src/app.js'),
        'one\ntwo\nthree\nfour\nfive\n',
      );
      git(['add', '.']);
      commit('Initial fixture');
      git(['checkout', '-b', 'feature']);
      fs.writeFileSync(path.join(dir, 'src/app.js'), 'one\n');
      fs.mkdirSync(path.join(dir, 'tests'));
      fs.writeFileSync(
        path.join(dir, 'tests/app.test.js'),
        'check one\ncheck two\n',
      );
      git(['add', '.']);
      commit('Smaller implementation with tests');
      const headSha = git(['rev-parse', 'HEAD']);
      git(['checkout', 'main']);
      fs.writeFileSync(path.join(dir, 'README.md'), 'Unrelated base work\n');
      git(['add', '.']);
      commit('Advance main');
      const summary = collectLineChanges(
        git(['rev-parse', 'HEAD']),
        headSha,
        dir,
      );
      assert.equal(summary.groups[0].net, -4);
      assert.equal(summary.groups[1].net, 2);
      assert.equal(summary.groups[2].added, 0);
      const root = path.resolve(__dirname, '../../../../..');
      fs.mkdirSync(path.join(dir, 'scripts/coverage'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'scripts/package.json'),
        JSON.stringify({ type: 'commonjs' }),
      );
      for (const name of ['generate-pr-summary.js', 'line-changes.js']) {
        fs.copyFileSync(
          path.join(root, 'scripts/coverage', name),
          path.join(dir, 'scripts/coverage', name),
        );
      }
      const output = execFileSync(
        process.execPath,
        ['scripts/coverage/generate-pr-summary.js'],
        {
          cwd: dir,
          env: {
            ...process.env,
            PR_BASE_SHA: git(['rev-parse', 'HEAD']),
            PR_HEAD_SHA: headSha,
            TRUSTROOTS_PR_INCLUDE_COVERAGE: 'false',
          },
          encoding: 'utf8',
        },
      );
      assert.match(output, /Pull request overview/);
      assert.match(output, /Tests and fixtures/);
      assert.doesNotMatch(output, /Coverage overview|Status:/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('backfills only older open PRs and keeps existing coverage', async () => {
    const calls = [];
    const pr = number => ({
      number,
      state: 'open',
      base: { sha: 'a'.repeat(40) },
      head: { sha: 'b'.repeat(40) },
    });
    const issues = {
      listComments() {},
      async updateComment(value) {
        calls.push(value);
      },
      async createComment(value) {
        calls.push(value);
      },
    };
    const pulls = {
      list() {},
      async get({ pull_number }) {
        return { data: pr(pull_number) };
      },
    };
    const github = {
      rest: { pulls, issues },
      async paginate(method, options) {
        return method === pulls.list
          ? [pr(2998), pr(2999), pr(3000), pr(3001)]
          : options.issue_number === 2998
          ? [
              {
                id: 7,
                user: { type: 'Bot' },
                body: `${marker}\nCoverage: 100%`,
              },
            ]
          : [{ id: 8, user: { type: 'User' }, body: marker }];
      },
    };
    const fetched = [];
    const updated = await backfill({
      github,
      owner: 'fictional-org',
      repo: 'fictional-repo',
      before: 3000,
      fetch: number => fetched.push(number),
      collect: () => summariseNumstat(''),
    });
    assert.deepEqual(updated, [2998, 2999]);
    assert.deepEqual(fetched, updated);
    assert.match(calls[0].body, /Coverage: 100%/);
    assert.equal(calls[0].comment_id, 7);
    assert.equal(calls[1].issue_number, 2999);
    await assert.rejects(backfill({ before: 0 }), /positive integer/);
    await assert.rejects(backfill({ before: 3000, only: 0 }), /selected PR/);
    calls.length = 0;
    assert.deepEqual(
      await backfill({
        github,
        owner: 'fictional-org',
        repo: 'fictional-repo',
        before: 3000,
        only: 2999,
        fetch() {},
        collect: () => summariseNumstat(''),
      }),
      [2999],
    );
    assert.equal(calls.length, 1);
  });

  it('keeps privileged report workflows on trusted main-branch tooling', () => {
    const root = path.resolve(__dirname, '../../../../..');
    const workflow = yaml.load(
      fs.readFileSync(
        path.join(root, '.github/workflows/pr-line-changes-backfill.yml'),
        'utf8',
      ),
    );
    assert.ok(workflow.on.pull_request_target);
    assert.ok(workflow.on.workflow_run);
    for (const job of Object.values(workflow.jobs)) {
      assert.equal(job.steps[0].with.ref, 'main');
      assert.equal(job.steps[0].with['fetch-depth'], 0);
      assert.ok(
        job.steps
          .slice(1)
          .every(step => step.uses.startsWith('actions/github-script@')),
      );
    }
    assert.match(
      workflow.jobs.backfill.if,
      /workflow_dispatch.*refs\/heads\/main/,
    );
    const tests = yaml.load(
      fs.readFileSync(path.join(root, '.github/workflows/test.yml'), 'utf8'),
    );
    assert.doesNotMatch(tests.jobs['coverage-summary'].if, /run-code/);
    assert.match(tests.jobs['coverage-summary'].steps.at(-1).if, /run-code/);
  });

  it('skips closed PRs and heads changed during backfill', async () => {
    let reads = 0;
    const github = {
      rest: {
        pulls: {
          list() {},
          async get({ pull_number }) {
            reads += 1;
            return {
              data: {
                number: pull_number,
                state: pull_number === 1 ? 'closed' : 'open',
                base: { sha: 'a'.repeat(40) },
                head: { sha: (reads === 2 ? 'b' : 'c').repeat(40) },
              },
            };
          },
        },
        issues: {
          listComments() {},
          async createComment() {
            assert.fail('Outdated summary posted');
          },
        },
      },
      async paginate(method) {
        return method === this.rest.pulls.list
          ? [{ number: 1 }, { number: 2 }]
          : [];
      },
    };
    assert.deepEqual(
      await backfill({
        github,
        owner: 'fictional-org',
        repo: 'fictional-repo',
        before: 3,
        fetch() {},
        collect: () => summariseNumstat(''),
      }),
      [],
    );
  });
});
