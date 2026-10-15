import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

interface PackageConfiguration {
  scripts: Record<string, string>;
}

const packageConfiguration = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as PackageConfiguration;
const scripts = packageConfiguration.scripts;

test('the default development server is Vite', () => {
  assert.match(scripts.start, /TRUSTROOTS_VITE_DEV_SERVER=true/);
  assert.match(scripts.start, /pnpm:vite:server/);
  assert.doesNotMatch(scripts.start, /webpack/);
  assert.equal(scripts['start:docker'], 'pnpm run start');
  assert.equal(scripts['start:vite'], 'pnpm run start');
});

test('client import resolution stays in the Vite configuration check', () => {
  assert.match(
    scripts['test:client:resolution'],
    /config\/client\/import-resolution\.test\.mjs/,
  );
  assert.match(
    scripts['test:vite:rtl'],
    /config\/client\/import-resolution\.test\.mjs/,
  );
});

test('production and browser tests use Vite without Webpack commands', () => {
  assert.match(scripts.build, /build:vite/);
  assert.match(scripts['build:vite'], /vite build/);
  for (const [name, command] of Object.entries(scripts)) {
    assert.doesNotMatch(name, /webpack/);
    assert.doesNotMatch(command, /webpack/);
  }
  const e2eBuild = readFileSync(
    new URL('../../scripts/e2e/build-web.sh', import.meta.url),
    'utf8',
  );
  assert.match(e2eBuild, /vite build/);
  const windowsWorkflow = readFileSync(
    new URL('../../.github/workflows/windows-map-wheel.yml', import.meta.url),
    'utf8',
  );
  assert.match(windowsWorkflow, /pnpm exec vite build/);
});
