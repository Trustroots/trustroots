import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import './lib/mail-safety.test.mts';

const root = fileURLToPath(new URL('..', import.meta.url));

function load(
  environment: string,
  local?: string,
  skipLocal = false,
  mailEnvironment: Record<string, string | undefined> = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'trustroots-config-'));
  try {
    const configDirectory = join(directory, 'config');
    mkdirSync(configDirectory);
    mkdirSync(join(configDirectory, 'lib'));
    cpSync(
      join(root, 'config/lib/mail-safety.mts'),
      join(configDirectory, 'lib/mail-safety.mts'),
    );
    for (const name of ['config.mts', 'assets', 'env', 'package.json']) {
      cpSync(join(root, 'config', name), join(configDirectory, name), {
        recursive: true,
        filter: source => !source.endsWith('/local.js'),
      });
    }
    symlinkSync(
      join(root, 'node_modules'),
      join(directory, 'node_modules'),
      'dir',
    );
    mkdirSync(join(directory, 'modules/example/server/routes'), {
      recursive: true,
    });
    writeFileSync(
      join(directory, 'modules/example/server/routes/example.mts'),
      '',
    );
    if (local) writeFileSync(join(configDirectory, 'env/local.js'), local);
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import config from './config/config.mts'; console.log('CONFIG_RESULT=' + JSON.stringify({ environment: process.env.NODE_ENV, config, paths: config.utils.getGlobbedPaths(['https://example.org/file', 'https://example.org/file']) }));",
      ],
      {
        cwd: directory,
        env: {
          ...process.env,
          NODE_ENV: environment,
          TRUSTROOTS_SKIP_LOCAL_CONFIG: skipLocal ? 'true' : '',
          TRUSTROOTS_SERVER_TEST_DATABASE: undefined,
          TRUSTROOTS_DEPLOYMENT_TIER: undefined,
          TRUSTROOTS_MAIL_MODE: undefined,
          TRUSTROOTS_MAIL_RECIPIENT_ALLOWLIST: undefined,
          TRUSTROOTS_SUPPORT_TEST_MAILBOX: undefined,
          ...mailEnvironment,
        },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = result.stdout
      .split('\n')
      .find(line => line.startsWith('CONFIG_RESULT='));
    assert.ok(output, result.stdout);
    const parsed = JSON.parse(output.slice('CONFIG_RESULT='.length)) as {
      environment: string;
      config: {
        app: { title: string; description: string };
        port: number;
        mailer: {
          options: { jsonTransport?: boolean; service?: string | false };
        };
        files: {
          server: {
            models: string[];
            routes: string[];
            configs: string[];
            policies: string[];
          };
        };
        db: { uri: string };
      };
      paths: string[];
    };
    return {
      ...parsed,
      mailStatus: result.stdout
        .split('\n')
        .find(line => line.startsWith('[Mail]')),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('runtime configuration discovers TypeScript routes once and deduplicates glob inputs', () => {
  const result = load('test');
  assert.equal(result.environment, 'test');
  assert.match(result.config.db.uri, /trustroots-test/);
  assert.deepEqual(result.config.files.server.routes, [
    'modules/example/server/routes/example.mts',
  ]);
  assert.deepEqual(result.paths, ['https://example.org/file']);
});

test('asset discovery is equivalent in development, test, and production', () => {
  const [development, testEnvironment, production] = [
    'development',
    'test',
    'production',
  ].map(environment => load(environment));

  assert.deepEqual(testEnvironment.config.files, development.config.files);
  assert.deepEqual(production.config.files, development.config.files);
});

test('CommonJS local configuration deep-merges nested environment settings', () => {
  const original = load('development');
  const result = load(
    'development',
    "module.exports = { app: { title: 'Example community' }, port: 4321 };",
  );
  assert.equal(result.config.app.title, 'Example community');
  assert.equal(result.config.app.description, original.config.app.description);
  assert.equal(result.config.port, 4321);
});

test('local configuration can be skipped and unknown environments use development', () => {
  const original = load('development');
  const result = load(
    'unknown-environment',
    'module.exports = { port: 4321 };',
    true,
  );
  assert.equal(result.environment, 'development');
  assert.equal(result.config.port, original.config.port);
});

test('environment configuration replaces nested defaults before local merging', () => {
  const result = load('development');
  assert.deepEqual(result.config.mailer.options, { jsonTransport: true });
});

test('startup reports effective live mode after local SMTP overrides without logging credentials', () => {
  const local =
    "module.exports = { domain: 'www.trustroots.org', mailer: { options: { host: 'smtp.example.test', auth: { user: 'fictional-user', pass: 'fictional-secret' } } } };";
  for (const mailEnvironment of [
    {},
    { TRUSTROOTS_DEPLOYMENT_TIER: 'production', TRUSTROOTS_MAIL_MODE: 'live' },
  ]) {
    const result = load('production', local, false, mailEnvironment);
    assert.equal(result.mailStatus, '[Mail] mode=live');
  }
});

test('startup makes intentional production capture visible and replaces inherited SMTP settings', () => {
  const result = load(
    'production',
    "module.exports = { domain: 'www.trustroots.org', mailer: { options: { host: 'smtp.example.test' } } };",
    false,
    {
      TRUSTROOTS_DEPLOYMENT_TIER: 'production',
      TRUSTROOTS_MAIL_MODE: 'capture',
    },
  );
  assert.equal(
    result.mailStatus,
    '[Mail] mode=capture; outgoing delivery disabled',
  );
  assert.deepEqual(result.config.mailer.options, { jsonTransport: true });
});
