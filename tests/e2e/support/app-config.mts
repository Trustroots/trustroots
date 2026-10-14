import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type TargetedRequestLimit = {
  windowMs: number;
  ipLimit: number;
  identityLimit: number;
};

export type E2EAppConfig = {
  sessionSecret: string;
  db: { uri: string };
  targetedRequestLimits: Record<string, TargetedRequestLimit>;
};

const packageRoot = path.resolve(import.meta.dirname, '../../..');
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

let config: E2EAppConfig;
try {
  execFileSync(process.execPath, ['--input-type=module', '-e', dumpScript], {
    cwd: packageRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const snapshot: unknown = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  if (!isE2EAppConfig(snapshot)) {
    throw new Error('The test config snapshot is missing required values.');
  }
  config = snapshot;
} finally {
  try {
    fs.unlinkSync(dumpPath);
  } catch {
    // Best-effort cleanup of the temporary config snapshot.
  }
}

function isE2EAppConfig(value: unknown): value is E2EAppConfig {
  if (!isRecord(value) || typeof value.sessionSecret !== 'string') {
    return false;
  }
  if (!isRecord(value.db) || typeof value.db.uri !== 'string') {
    return false;
  }
  if (!isRecord(value.targetedRequestLimits)) {
    return false;
  }

  return Object.values(value.targetedRequestLimits).every(
    policy =>
      isRecord(policy) &&
      typeof policy.windowMs === 'number' &&
      typeof policy.ipLimit === 'number' &&
      typeof policy.identityLimit === 'number',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default config;
