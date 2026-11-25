import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getModuleFiles } from './module-registration.mts';

const root = new URL('../../', import.meta.url);

function discover(pattern: string) {
  return globSync(pattern, { cwd: fileURLToPath(root) })
    .sort()
    .map(file => fileURLToPath(new URL(file, root)));
}

test('server entries include every model and configuration file in startup order', () => {
  assert.deepEqual(
    getModuleFiles('models'),
    discover('modules/*/server/models/**/*.{cjs,mts}'),
  );
  assert.deepEqual(
    getModuleFiles('config'),
    discover('modules/*/server/config/*.mts'),
  );
});

test('server entries include every route registrar and put the core catch-all last', () => {
  assert.deepEqual(getModuleFiles('routes'), [
    ...discover('modules/!(core)/server/routes/**/*.{cjs,mts}'),
    ...discover('modules/core/server/routes/**/*.{cjs,mts}'),
  ]);
});
