const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Playwright's CommonJS transform breaks Node's ESM interop when lodash is
// imported from config/config.mjs via createRequire. Load the config in a
// fresh Node process instead and rehydrate the JSON snapshot here.
const packageRoot = path.resolve(__dirname, '../../..');
const dumpPath = path.join(
  os.tmpdir(),
  `trustroots-e2e-config-${process.pid}.json`,
);
const dumpScript = `
import config from ${JSON.stringify(
  path.join(packageRoot, 'config/config.mjs'),
)};
import fs from 'node:fs';
fs.writeFileSync(${JSON.stringify(dumpPath)}, JSON.stringify(config));
`;

const env = { ...process.env };
if (!env.NODE_ENV) {
  env.NODE_ENV = 'test';
}

try {
  execFileSync(process.execPath, ['--input-type=module', '-e', dumpScript], {
    cwd: packageRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  module.exports = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
} finally {
  try {
    fs.unlinkSync(dumpPath);
  } catch (error) {
    // Best-effort cleanup of the temporary config snapshot.
  }
}
