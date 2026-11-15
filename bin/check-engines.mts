#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import semver from 'semver';

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  engines: { node: string; pnpm: string };
  packageManager: string;
};

export function validateEngines(
  nodeVersion: string | undefined,
  pnpmVersion: string | undefined,
): string[] {
  const errors: string[] = [];

  if (!nodeVersion || !semver.satisfies(nodeVersion, manifest.engines.node)) {
    errors.push(
      `Node ${nodeVersion ?? 'version unavailable'} does not satisfy ${manifest.engines.node}`,
    );
  }
  if (!pnpmVersion || !semver.satisfies(pnpmVersion, manifest.engines.pnpm)) {
    errors.push(
      pnpmVersion
        ? `pnpm ${pnpmVersion} does not satisfy ${manifest.engines.pnpm}`
        : `pnpm was not found or could not run. Enable Corepack and use ${manifest.packageManager}.`,
    );
  }

  return errors;
}

export function getPnpmVersion(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const result = spawnSync('pnpm', ['--version'], {
    encoding: 'utf8',
    env,
    shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) return undefined;
  return result.stdout.trim();
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = validateEngines(process.versions.node, getPnpmVersion());
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}
