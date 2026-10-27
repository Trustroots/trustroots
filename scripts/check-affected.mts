#!/usr/bin/env node
import {
  execFileSync,
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
type Run = (
  command: string,
  args: string[],
  options: SpawnSyncOptionsWithStringEncoding,
) => Pick<SpawnSyncReturns<string>, 'status' | 'signal' | 'error'>;

export function fullCheckReason(root: string, base: string): string | null {
  try {
    const git = (...args: string[]) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    const mergeBase = git('merge-base', base, 'HEAD').trim();
    const files = [
      ...git(
        'diff',
        '--name-only',
        '--no-renames',
        '-z',
        mergeBase,
        '--',
      ).split('\0'),
      ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0'),
    ].filter(Boolean);
    const modules = new Set(
      fs
        .readdirSync(path.join(root, 'modules'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .filter(entry => {
          const manifest = JSON.parse(
            fs.readFileSync(
              path.join(root, 'modules', entry.name, 'package.json'),
              'utf8',
            ),
          );
          return (
            manifest.name === `@trustroots/${entry.name}` &&
            manifest.private === true
          );
        })
        .map(entry => entry.name),
    );
    const outside = files.find(file => {
      const [top, name, ...rest] = file.split('/');
      return top !== 'modules' || !modules.has(name) || rest.length === 0;
    });
    return outside
      ? `change outside module workspace packages: ${outside}`
      : null;
  } catch {
    return 'Git comparison or module workspace discovery is unavailable';
  }
}

export function main(
  root = ROOT,
  env: NodeJS.ProcessEnv = process.env,
  run: Run = spawnSync,
): number {
  const base = env.TURBO_SCM_BASE || 'origin/main';
  const reason = fullCheckReason(root, base);
  const commands = reason
    ? [['run', 'check']]
    : [
        ['run', 'lint:boundaries'],
        ['exec', 'turbo', 'run', 'lint', 'test:client', '--affected'],
        ['run', 'typecheck'],
      ];
  console.log(
    reason
      ? `Running full checks: ${reason}.`
      : `Checking package boundaries, then affected modules against ${base} and the full typecheck.`,
  );
  for (const args of commands) {
    const result = run(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      args,
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...env, TURBO_SCM_BASE: base },
        stdio: 'inherit',
      },
    );
    if (result.error) {
      console.error(result.error.message);
      return (result.error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 127
        : 1;
    }
    if (result.signal) {
      return 128 + os.constants.signals[result.signal];
    }
    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }
  return 0;
}

if (import.meta.main) {
  process.exitCode = main();
}
