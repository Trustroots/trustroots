import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import manifest from '../package.json' with { type: 'json' };
import { getPnpmVersion, validateEngines } from './check-engines.mts';

const pnpmVersion = manifest.packageManager.slice('pnpm@'.length);

test('accepts supported Node and pnpm versions', () => {
  assert.deepEqual(validateEngines(process.versions.node, pnpmVersion), []);
});

test('rejects unsupported Node and pnpm versions', () => {
  assert.deepEqual(validateEngines('0.0.0', '0.0.0'), [
    `Node 0.0.0 does not satisfy ${manifest.engines.node}`,
    `pnpm 0.0.0 does not satisfy ${manifest.engines.pnpm}`,
  ]);
});

test('reports missing pnpm', () => {
  assert.deepEqual(validateEngines(process.versions.node, undefined), [
    `pnpm was not found or could not run. Enable Corepack and use ${manifest.packageManager}.`,
  ]);
});

test('reads pnpm version from the executable on PATH', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'check-engines-'));
  try {
    const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const executable = path.join(directory, command);
    await writeFile(
      executable,
      process.platform === 'win32'
        ? '@echo off\r\necho 12.16.1\r\n'
        : '#!/bin/sh\nprintf "12.16.1\\n"\n',
    );
    if (process.platform !== 'win32') await chmod(executable, 0o755);
    const pathVariable =
      process.platform === 'win32'
        ? (Object.keys(process.env).find(key => key.toUpperCase() === 'PATH') ??
          'PATH')
        : 'PATH';
    const env = { ...process.env, [pathVariable]: directory };
    assert.equal(getPnpmVersion(env), '12.16.1');
    await rm(executable);
    assert.equal(getPnpmVersion(env), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
