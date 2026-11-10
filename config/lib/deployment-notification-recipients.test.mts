import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { canPreviewDeploymentNotificationRecipients } from './deployment-notification-recipients.mts';

const production = {
  NODE_ENV: 'production',
  TRUSTROOTS_DEPLOYMENT_TIER: 'production',
};

test('recipient preview requires each production mail gate', () => {
  const canPreview = canPreviewDeploymentNotificationRecipients;
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
