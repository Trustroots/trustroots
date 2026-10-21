import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { expectedManifest, main } from './check-module-packages.mts';

function makeRepo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'module-packages-'));
  Object.entries(files).forEach(([name, text]) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  });
  return root;
}

const BASELINE = JSON.stringify({
  imports: { a: ['b'] },
  models: { a: ['c'], c: ['b'] },
});

const FIXTURE = {
  'module-graph-baseline.json': BASELINE,
  'modules/a/client/one.js': '',
  'modules/a/server/two.mjs': '',
  'modules/a/tests/client/one.tests.js': '',
  'modules/a/tests/server/two.tests.js': '',
  'modules/b/shared/x.js': '',
  'modules/c/server/model.mjs': '',
  'modules/c/tests/server/model.tests.js': '',
};

test('manifest declares baseline links as workspace dependencies and scripts for the test folders present', () => {
  const root = makeRepo(FIXTURE);
  const manifest = expectedManifest('a', root);
  assert.equal(manifest.name, '@trustroots/a');
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.dependencies, {
    '@trustroots/b': 'workspace:*',
    '@trustroots/c': 'workspace:*',
  });
  assert.deepEqual(Object.keys(manifest.scripts), [
    'lint',
    'test:client',
    'test:server',
  ]);
  assert.deepEqual(Object.keys(manifest.exports), ['./client/*']);
});

test('manifest of a module without client tests has no test:client script and no dependencies key', () => {
  const root = makeRepo(FIXTURE);
  const manifest = expectedManifest('b', root);
  assert.equal('dependencies' in manifest, false);
  assert.deepEqual(Object.keys(manifest.scripts), ['lint']);
  assert.deepEqual(Object.keys(manifest.exports), ['./shared/*']);
});

test('manifest declares the ui package when module code imports it', () => {
  const root = makeRepo({
    ...FIXTURE,
    'modules/b/client/button.tsx': "import { Button } from '@trustroots/ui';\n",
  });
  assert.deepEqual(expectedManifest('b', root).dependencies, {
    '@trustroots/ui': 'workspace:*',
  });
  assert.deepEqual(expectedManifest('a', root).dependencies, {
    '@trustroots/b': 'workspace:*',
    '@trustroots/c': 'workspace:*',
  });
});

test('main fails on a missing or drifted manifest and passes after --update', () => {
  const root = makeRepo(FIXTURE);
  assert.equal(main([], root), 1);
  assert.equal(main(['--update'], root), 0);
  assert.equal(main([], root), 0);

  const file = path.join(root, 'modules/b/package.json');
  fs.writeFileSync(file, '{"name":"@trustroots/b"}\n');
  assert.equal(main([], root), 1);
});
