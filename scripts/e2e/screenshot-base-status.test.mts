import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateScreenshotBaseStatus } from './screenshot-base-status.mts';

test('accepts successful and failed base specs as completed runs', () => {
  assert.equal(
    validateScreenshotBaseStatus(JSON.stringify({ status: 'passed' })),
    'passed',
  );
  assert.equal(
    validateScreenshotBaseStatus(JSON.stringify({ status: 'failed' })),
    'failed',
  );
});

test('fails when the base run was blocked during setup', () => {
  assert.throws(
    () =>
      validateScreenshotBaseStatus(
        JSON.stringify({
          status: 'blocked',
          message: 'MongoDB did not start.',
        }),
      ),
    /Base E2E setup was blocked: MongoDB did not start\./,
  );
});

test('fails when no usable base-run status was written', () => {
  for (const contents of ['', 'not JSON', 'null', '{}']) {
    assert.throws(() => validateScreenshotBaseStatus(contents));
  }
});
