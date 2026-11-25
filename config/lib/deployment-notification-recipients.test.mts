import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { canSendDeploymentNotifications } from './deployment-notification-recipients.mts';
import {
  deploymentNotificationHandler,
  readDeploymentSuccessReceipt,
} from './deployment-notifications.mts';

const production = {
  NODE_ENV: 'production',
  TRUSTROOTS_DEPLOYMENT_TIER: 'production',
};

test('recipient preview requires each production mail gate', () => {
  const canPreview = canSendDeploymentNotifications;
  assert.equal(canPreview('trustroots.org', 'live', production), true);
  assert.equal(canPreview('WWW.TRUSTROOTS.ORG.', 'live', production), true);
  assert.equal(canPreview('staging.trustroots.org', 'live', production), false);
  assert.equal(canPreview('trustroots.org', 'capture', production), false);
  assert.equal(canPreview('trustroots.org', 'allowlist', production), false);
  assert.equal(
    canPreview('trustroots.org', 'live', { NODE_ENV: 'production' }),
    false,
  );
  assert.equal(
    canPreview('trustroots.org', 'live', {
      ...production,
      TRUSTROOTS_DEPLOYMENT_TIER: 'staging',
    }),
    false,
  );
  assert.equal(
    canPreview('trustroots.org', 'live', {
      ...production,
      NODE_ENV: 'development',
    }),
    false,
  );
});

test('the preview command refuses staging and production capture', () => {
  for (const tier of ['staging', 'production']) {
    const result = spawnSync(
      process.execPath,
      ['bin/preview-deployment-notification-recipients.mts'],
      {
        encoding: 'utf8',
        timeout: 10_000,
        env: {
          ...process.env,
          ...production,
          TRUSTROOTS_DEPLOYMENT_TIER: tier,
          TRUSTROOTS_MAIL_MODE: 'capture',
          TRUSTROOTS_SKIP_LOCAL_CONFIG: '1',
        },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    assert.match(
      result.stderr,
      /Recipient preview requires explicit production/,
    );
    assert.doesNotMatch(result.stdout, /Eligible deployment notification/);
  }
});

test('the queue command refuses production capture before reading receipts', () => {
  const result = spawnSync(
    process.execPath,
    ['bin/queue-deployment-notifications.mts'],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        ...production,
        TRUSTROOTS_MAIL_MODE: 'capture',
        TRUSTROOTS_SKIP_LOCAL_CONFIG: '1',
      },
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Deployment notifications require explicit production/,
  );
  assert.doesNotMatch(result.stdout, /Deployment notification destinations/);
});

test('only successful, well-formed production receipts are accepted', () => {
  const receipt = {
    schemaVersion: 1,
    status: 'succeeded',
    eventId: '11111111-2222-4333-8444-555555555555',
    origin: 'https://www.trustroots.org',
    action: 'rollback',
    buildCommit: 'c'.repeat(40),
    readinessSucceededAt: '2026-01-02T03:04:05.123456+00:00',
  };
  assert.deepEqual(readDeploymentSuccessReceipt(JSON.stringify(receipt)), {
    eventId: receipt.eventId,
    origin: receipt.origin,
    action: receipt.action,
    buildCommit: receipt.buildCommit,
    readinessSucceededAt: receipt.readinessSucceededAt,
  });
  for (const changes of [
    { schemaVersion: 2 },
    { status: 'pending' },
    { status: 'failed' },
    { eventId: '../receipt.json' },
    { origin: 'https://example.test' },
    { action: 'restart' },
    { buildCommit: 'invalid' },
    { readinessSucceededAt: '2026-42-02T03:04:05+00:00' },
    { readinessSucceededAt: '2026-01-02T03:04:05+01:00' },
  ]) {
    assert.throws(
      () =>
        readDeploymentSuccessReceipt(
          JSON.stringify({ ...receipt, ...changes }),
        ),
      /Expected a successful production deployment receipt/,
    );
  }
});

test('a queued notification can only reach the SMTP handler in production live mode', t => {
  const savedRuntime = process.env.NODE_ENV;
  const savedTier = process.env.TRUSTROOTS_DEPLOYMENT_TIER;
  t.after(() => {
    if (savedRuntime === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedRuntime;
    if (savedTier === undefined) delete process.env.TRUSTROOTS_DEPLOYMENT_TIER;
    else process.env.TRUSTROOTS_DEPLOYMENT_TIER = savedTier;
  });
  Object.assign(process.env, production);
  const send = t.mock.fn<Parameters<typeof deploymentNotificationHandler>[2]>(
    (_job, done) => done(),
  );
  const complete = t.mock.fn<(error?: Error | null) => void>();
  deploymentNotificationHandler(
    'trustroots.org',
    'capture',
    send,
  )({} as never, complete);
  assert.match(
    complete.mock.calls[0].arguments[0]!.message,
    /requires production and live mail/,
  );
  assert.equal(send.mock.callCount(), 0);
  deploymentNotificationHandler(
    'trustroots.org',
    'live',
    send,
  )({} as never, complete);
  assert.equal(send.mock.callCount(), 1);
  assert.equal(complete.mock.calls[1].arguments[0], undefined);
});
