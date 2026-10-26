import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fullCheckReason, main } from './check-affected.mts';

function repository(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'affected-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: os.devNull,
        GIT_CONFIG_NOSYSTEM: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const write = (name: string, content = 'fixture\n') => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  git('init');
  git('config', 'user.name', 'Fixture Member');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', path.join(root, 'no-hooks'));
  write(
    'modules/alpha/package.json',
    JSON.stringify({ name: '@trustroots/alpha', private: true }),
  );
  write('modules/alpha/client/example.ts');
  write('layers/shell/client/routes.tsx');
  write('.gitignore', 'ignored/\n');
  git('add', '.');
  git('commit', '-m', 'Create fixture');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('branch', 'baseline');
  return { root, git, write };
}

test('keeps the affected path for no changes and ignored files', t => {
  const { root, write } = repository(t);
  assert.equal(fullCheckReason(root, 'origin/main'), null);
  write('ignored/note.txt');
  assert.equal(fullCheckReason(root, 'origin/main'), null);
});

for (const state of ['committed', 'staged', 'unstaged', 'untracked']) {
  for (const location of ['module', 'shell']) {
    test(`includes ${state} ${location} changes`, t => {
      const { root, git, write } = repository(t);
      const file =
        location === 'module'
          ? 'modules/alpha/client/example.ts'
          : 'layers/shell/client/routes.tsx';
      write(state === 'untracked' ? `${file}.new` : file, 'changed\n');
      if (state === 'staged' || state === 'committed') git('add', '.');
      if (state === 'committed') git('commit', '-m', 'Change fixture');
      const reason = fullCheckReason(root, 'origin/main');
      if (location === 'module') assert.equal(reason, null);
      else
        assert.match(
          reason!,
          /outside module workspace packages: layers\/shell\//,
        );
    });
  }
}

test('falls back for a root change mixed with module changes', t => {
  const { root, write } = repository(t);
  write('modules/alpha/client/example.ts', 'changed\n');
  write('root configuration.json');
  assert.match(
    fullCheckReason(root, 'origin/main')!,
    /root configuration.json/,
  );
});

test('handles spaces and newlines in filenames using NUL delimiters', t => {
  const { root, write } = repository(t);
  write('modules/alpha/client/new file\nexample.ts');
  assert.equal(fullCheckReason(root, 'origin/main'), null);
  write('layers/shell/client/new file\nexample.tsx');
  assert.match(
    fullCheckReason(root, 'origin/main')!,
    /outside module workspace packages/,
  );
});

test('includes deleted paths and both ends of a rename', t => {
  const { root, git } = repository(t);
  git(
    'mv',
    'layers/shell/client/routes.tsx',
    'modules/alpha/client/routes.tsx',
  );
  assert.match(fullCheckReason(root, 'origin/main')!, /layers\/shell/);
  git('commit', '-m', 'Move fixture');
  assert.match(fullCheckReason(root, 'origin/main')!, /layers\/shell/);
});

test('module-only deletions remain affected checks', t => {
  const { root, git } = repository(t);
  git('rm', 'modules/alpha/client/example.ts');
  assert.equal(fullCheckReason(root, 'origin/main'), null);
});

test('falls back for unknown, renamed or invalid module packages', t => {
  const { root, write } = repository(t);
  write('modules/unknown/client/example.ts');
  assert.match(fullCheckReason(root, 'origin/main')!, /unavailable/);
});

for (const manifest of [
  '{',
  '{}',
  '{"name":"@trustroots/other","private":true}',
]) {
  test(`does not select an unrecognised manifest: ${manifest}`, t => {
    const { root, write } = repository(t);
    write('modules/alpha/package.json', manifest);
    assert.ok(fullCheckReason(root, 'origin/main'));
  });
}

test('uses a merge base when the comparison branch has advanced', t => {
  const { root, git, write } = repository(t);
  const original = git('rev-parse', 'HEAD').trim();
  write('modules/alpha/client/example.ts', 'branch change\n');
  git('commit', '-am', 'Change module');
  const branch = git('rev-parse', 'HEAD').trim();
  git('checkout', '--detach', original);
  write('new-root-file');
  git('add', '.');
  git('commit', '-m', 'Advance base');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('checkout', '--detach', branch);
  assert.equal(fullCheckReason(root, 'origin/main'), null);
});

test('uses an explicit comparison base', t => {
  const { root, git, write } = repository(t);
  write('layers/shell/client/routes.tsx', 'changed\n');
  git('commit', '-am', 'Change shell');
  git('branch', 'new-base');
  assert.ok(fullCheckReason(root, 'baseline'));
  assert.equal(fullCheckReason(root, 'new-base'), null);
});

test('falls back when history is unavailable or the directory is not a repository', t => {
  const { root } = repository(t);
  assert.match(fullCheckReason(root, 'missing-reference')!, /unavailable/);
  assert.match(
    fullCheckReason(path.join(root, 'no-hooks'), 'HEAD')!,
    /unavailable/,
  );
});

test('checks boundaries, runs Turbo then repository-wide typechecking and forwards the base', t => {
  t.mock.method(console, 'log', () => {});
  const { root } = repository(t);
  const calls: string[][] = [];
  assert.equal(
    main(root, { TURBO_SCM_BASE: 'baseline' }, (command, args, options) => {
      assert.match(command, /^pnpm(?:\.cmd)?$/);
      assert.equal(options.cwd, root);
      assert.equal(options.env?.TURBO_SCM_BASE, 'baseline');
      calls.push(args);
      return { status: 0, signal: null };
    }),
    0,
  );
  assert.deepEqual(calls, [
    ['run', 'lint:boundaries'],
    ['exec', 'turbo', 'run', 'lint', 'test:client', '--affected'],
    ['run', 'typecheck'],
  ]);
});

test('runs the full check and explains fallback without invoking Turbo', t => {
  const log = t.mock.method(console, 'log', () => {});
  const { root, write } = repository(t);
  write('layers/shell/client/routes.tsx', 'changed\n');
  const calls: string[][] = [];
  assert.equal(
    main(root, {}, (_command, args, options) => {
      assert.equal(options.env?.TURBO_SCM_BASE, 'origin/main');
      calls.push(args);
      return { status: 0, signal: null };
    }),
    0,
  );
  assert.deepEqual(calls, [['run', 'check']]);
  assert.match(
    log.mock.calls[0].arguments[0],
    /Running full checks:.*layers\/shell/,
  );
});

for (const result of [
  { status: 2, signal: null, expected: 2 },
  { status: null, signal: null, expected: 1 },
  {
    status: null,
    signal: 'SIGTERM' as const,
    expected: 128 + os.constants.signals.SIGTERM,
  },
  {
    status: null,
    signal: null,
    error: Object.assign(new Error('missing command'), { code: 'ENOENT' }),
    expected: 127,
  },
  {
    status: null,
    signal: null,
    error: new Error('cannot launch'),
    expected: 1,
  },
]) {
  test(`stops and reports a failed subprocess (${result.expected})`, t => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    const { root } = repository(t);
    let calls = 0;
    assert.equal(
      main(root, {}, () => {
        calls++;
        return result;
      }),
      result.expected,
    );
    assert.equal(calls, 1);
  });
}

test('propagates a typecheck failure after boundary checks and Turbo pass', t => {
  t.mock.method(console, 'log', () => {});
  const { root } = repository(t);
  let calls = 0;
  assert.equal(
    main(root, {}, () => ({ status: ++calls < 3 ? 0 : 3, signal: null })),
    3,
  );
  assert.equal(calls, 3);
});
