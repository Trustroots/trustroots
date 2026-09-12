#!/usr/bin/env node

const { spawnSync } = require('child_process');

const testFiles = process.argv.slice(2).filter(Boolean);

if (testFiles.length === 0) {
  console.error('Usage: npm run test:server:files -- <test-file> [test-file...]');
  process.exit(1);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const result = spawnSync(npmCommand, ['run', 'test:server'], {
  env: {
    ...process.env,
    SERVER_TEST_FILES: testFiles.join(','),
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(result.error.code === 'ENOENT' ? 127 : 1);
}

process.exit(result.status === null ? 1 : result.status);
