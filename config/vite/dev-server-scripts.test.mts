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

test('Webpack remains an explicit development server and production fallback', () => {
  assert.match(scripts['start:webpack'], /pnpm:webpack:server/);
  assert.doesNotMatch(scripts['start:webpack'], /VITE/);
  assert.match(scripts.build, /build:vite/);
  assert.doesNotMatch(scripts.build, /build:webpack/);
  assert.match(scripts['build:webpack'], /pnpm run webpack/);
});
