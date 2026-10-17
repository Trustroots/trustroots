#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { globSync } = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');

const [kind, moduleName, ...extraArguments] = process.argv.slice(2);

if (!['client', 'server'].includes(kind) || !moduleName) {
  console.error('Usage: test-module.cts <client|server> <module> [args...]');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const testDirectory = `modules/${moduleName}/tests/${kind}`;

const result =
  kind === 'client'
    ? spawnSync(
        pnpmCommand,
        ['run', 'test:client', testDirectory, ...extraArguments],
        { cwd: root, stdio: 'inherit' },
      )
    : spawnSync(pnpmCommand, ['run', 'test:server'], {
        cwd: root,
        env: {
          ...process.env,
          SERVER_TEST_FILES: globSync(`${testDirectory}/**/*.{js,cts,mts}`, {
            cwd: root,
          })
            .sort()
            .join(','),
        },
        stdio: 'inherit',
      });

if (result.error) {
  console.error(result.error.message);
  process.exit(result.error.code === 'ENOENT' ? 127 : 1);
}

process.exit(result.status === null ? 1 : result.status);
