import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { analyze } from './check-module-runtime-boundaries.mts';

function makeRepo(t: TestContext, files: Record<string, string>): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'module-runtime-boundaries-'),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return root;
}

const manifest = (name: string) => JSON.stringify({ name, private: true });

test('rejects every forbidden runtime tier direction across import spellings', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/client/cross.ts': [
      "import server from '../server/entry';",
      "import serverAlias from '@/modules/a/server/entry';",
      "import serverPackage from '@trustroots/a/server/entry';",
    ].join('\n'),
    'modules/a/server/cross.ts': "import client from '../client/entry';",
    'modules/a/shared/cross.ts': [
      "import client from '../client/entry';",
      "import server from '@trustroots/a/server/entry';",
    ].join('\n'),
    'modules/a/client/entry.ts': 'export const client = 1;',
    'modules/a/server/entry.ts': 'export const server = 1;',
  });

  assert.equal(analyze(root).length, 6);
});

test('allows shared imports and client/server imports of shared code', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/shared/entry.ts': 'export const shared = 1;',
    'modules/a/shared/uses-shared.ts': "import shared from './entry';",
    'modules/a/client/uses-shared.ts': "import shared from '../shared/entry';",
    'modules/a/server/uses-shared.ts':
      "import shared from '@trustroots/a/shared/entry';",
    'modules/b/package.json': manifest('@trustroots/b'),
    'modules/b/server/entry.ts':
      "import shared from '@trustroots/a/shared/entry';",
  });

  assert.deepEqual(analyze(root), []);
});

test('ignores test files and unrelated repository packages', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/client/entry.tests.ts': "import server from '../server/entry';",
    'modules/a/server/entry.ts': 'export const server = 1;',
    'packages/helper/package.json': manifest('@trustroots/helper'),
    'packages/helper/index.ts':
      "import server from '../../modules/a/server/entry';",
  });

  assert.deepEqual(analyze(root), []);
});

test('classifies module paths without relying on valid package manifests', t => {
  const root = makeRepo(t, {
    'modules/a/client/entry.ts': [
      "import relative from '../../b/server/entry';",
      "import alias from '@/modules/c/server/entry';",
    ].join('\n'),
    'modules/b/server/entry.ts': 'export default 1;',
    'modules/c/package.json': '{ malformed',
    'modules/c/server/entry.ts': 'export default 1;',
    'modules/a/server/entry.ts': "import client from '../../b/client/entry';",
    'modules/b/client/entry.ts': 'export default 1;',
    'modules/a/shared/entry.ts':
      "import client from '@/modules/c/client/entry';",
    'modules/c/client/entry.ts': 'export default 1;',
  });
  assert.deepEqual(
    analyze(root)
      .map(({ specifier }) => specifier)
      .sort(),
    [
      '../../b/server/entry',
      '@/modules/c/server/entry',
      '../../b/client/entry',
      '@/modules/c/client/entry',
    ].sort(),
  );
});
