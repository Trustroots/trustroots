import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  analyze,
  diffGraphs,
  findCycles,
  main,
} from './check-module-graph.mts';

function makeRepo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'module-graph-'));
  Object.entries(files).forEach(([name, text]) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  });
  return root;
}

const FIXTURE = {
  'modules/a/client/one.js':
    "import x from '@/modules/b/client/x';\nimport y from 'modules/c/shared/y';",
  'modules/a/server/two.mjs':
    "import z from './../../b/server/z.mjs';\nconst s = require('../../a/server/two.mjs');",
  'modules/a/tests/server/ignored.js': "import q from '@/modules/c/client/q';",
  'modules/b/server/model.mjs': "mongoose.model('Thing', schema);",
  'modules/c/server/use.js':
    "const Thing = mongoose.model('Thing');\nconst T = mongoose.model('Unknown');",
  'modules/b/shared/back.js':
    "import w from '@/modules/a/shared/w';\nimport v from 'lodash/modules/x';",
};

test('records imports across all three styles and model lookups, ignoring tests and self links', () => {
  const root = makeRepo(FIXTURE);
  assert.deepEqual(analyze(root), {
    imports: { a: ['b', 'c'], b: ['a'] },
    models: { c: ['b'] },
  });
});

test('diffGraphs reports added and removed links', () => {
  const baseline = { imports: { a: ['b'] }, models: {} };
  const current = { imports: { a: ['c'] }, models: { a: ['b'] } };
  assert.deepEqual(diffGraphs(baseline, current), {
    added: ['imports: a -> c', 'models: a -> b'],
    removed: ['imports: a -> b'],
  });
});

test('workspace imports preserve edges across import forms and reject new links', t => {
  t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});
  const root = makeRepo({
    'modules/a/client/one.ts': [
      "import b from '@trustroots/b';",
      "export { value } from '@trustroots/c/shared/value';",
      "const d = import('@trustroots/d/client/value');",
      "const e = require('@trustroots/e/server/value');",
      "type F = import('@trustroots/f/shared/value').Value;",
      "require.resolve('@trustroots/g/shared/value');",
      "vi.mock('@trustroots/h/client/value');",
      "vi.importActual('@trustroots/i/shared/value');",
      "import self from '@trustroots/a/shared/value';",
      "import external from '@trustroots/unknown';",
      "import unrelated from '@another/b';",
      "import similarlyNamed from '@trustroots/b-extra';",
    ].join('\n'),
    ...Object.fromEntries(
      'bcdefghi'
        .split('')
        .map(name => [
          `modules/${name}/shared/value.ts`,
          'export const value = 1;',
        ]),
    ),
    'module-graph-baseline.json': JSON.stringify({ imports: {}, models: {} }),
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const expected = { imports: { a: 'bcdefghi'.split('') }, models: {} };
  assert.deepEqual(analyze(root), expected);
  assert.equal(main([], root), 1);
  assert.match(error.mock.calls.at(-1)!.arguments[0], /imports: a -> b/);
  fs.writeFileSync(
    path.join(root, 'module-graph-baseline.json'),
    JSON.stringify(expected),
  );
  assert.equal(main([], root), 0);
  const file = path.join(root, 'modules/a/client/one.ts');
  fs.writeFileSync(
    file,
    fs.readFileSync(file, 'utf8').replaceAll('@trustroots/', '@/modules/'),
  );
  assert.deepEqual(analyze(root), expected);
});

test('records cross-module imports in .mts source files', () => {
  const root = makeRepo({
    'modules/a/shared/one.mts':
      "import type { Value } from '@/modules/b/shared/value.mts';",
    'modules/b/shared/value.mts': 'export type Value = string;',
  });
  assert.deepEqual(analyze(root), { imports: { a: ['b'] }, models: {} });
});

test('records inline type imports and rejects new cross-module links', t => {
  t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});
  const root = makeRepo({
    'modules/a/client/one.ts': [
      "export type Value = import('@/modules/b/shared/value').Value;",
      "export type Module = typeof import('modules/c/shared/value');",
      "export type Relative = import('../../d/shared/value').Value;",
      "export type Local = import('../shared/value').Value;",
      "export type External = import('external-package').Value;",
    ].join('\n'),
    'modules/b/shared/value.ts': 'export type Value = string;',
    'modules/c/shared/value.ts': 'export const value = 1;',
    'modules/d/shared/value.mts': 'export type Value = number;',
    'module-graph-baseline.json': JSON.stringify({ imports: {}, models: {} }),
  });
  assert.deepEqual(analyze(root), {
    imports: { a: ['b', 'c', 'd'] },
    models: {},
  });
  assert.equal(main([], root), 1);
  assert.match(error.mock.calls.at(-1)!.arguments[0], /imports: a -> b/);
});

test('ignores imports and model calls in comments, strings and template text', () => {
  const root = makeRepo({
    'modules/a/client/one.tsx': [
      "// import x from '@/modules/b/client/x';",
      "/* require('@/modules/b/client/x'); mongoose.model('Thing'); */",
      'const example = "import x from \'@/modules/b/client/x\';";',
      "const template = `require('@/modules/b/client/x'); mongoose.model('Thing');`;",
      "const pattern = /model('Thing')/;",
      "const view = <div>import x from '@/modules/b/client/x'</div>;",
    ].join('\n'),
    'modules/b/server/model.mjs': "mongoose.model('Thing', schema);",
    'modules/c/server/comment.mjs': "// mongoose.model('Thing', schema);",
  });
  assert.deepEqual(analyze(root), { imports: {}, models: {} });
});

test('records multiline imports, re-exports and calls inside template expressions', () => {
  const root = makeRepo({
    'modules/a/client/one.ts': [
      "import /* explanation */ { x } from /* explanation */ '@/modules/b/client/x';",
      "export { y } from '@/modules/c/shared/y';",
      "const loaded = `${import('@/modules/d/shared/value')}`;",
      "require.resolve('@/modules/e/server/file');",
      "vi.importActual('@/modules/f/shared/value');",
      "vi.mock('@/modules/g/shared/value');",
      "mongoose.model(/* explanation */ 'Thing');",
    ].join('\n'),
    'modules/b/client/x.js': 'export const x = 1;',
    'modules/c/shared/y.ts': 'export const y = 1;',
    'modules/d/shared/value.ts': 'export const value = 1;',
    'modules/e/server/file.cjs': 'module.exports = {};',
    'modules/f/shared/value.ts': 'export const value = 1;',
    'modules/g/shared/value.ts': 'export const value = 1;',
    'modules/h/server/model.mjs': "mongoose.model('Thing', schema);",
  });
  assert.deepEqual(analyze(root), {
    imports: { a: ['b', 'c', 'd', 'e', 'f', 'g'] },
    models: { a: ['h'] },
  });
});

test('findCycles returns only components with more than one module', () => {
  assert.deepEqual(findCycles({ a: ['b'], b: ['a', 'c'], c: [] }), [
    ['a', 'b'],
  ]);
  assert.deepEqual(findCycles({ a: ['b'], b: [] }), []);
});

test('main fails on a new link, fails on a stale baseline and passes when equal', t => {
  t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});
  const root = makeRepo(FIXTURE);
  assert.equal(main([], root), 1);
  assert.equal(main(['--update'], root), 0);
  assert.equal(main([], root), 0);

  fs.mkdirSync(path.join(root, 'modules/c/client'));
  fs.writeFileSync(
    path.join(root, 'modules/c/client/new.js'),
    "import a from '@/modules/a/client/one';",
  );
  assert.equal(main([], root), 1);
  assert.match(error.mock.calls.at(-1)!.arguments[0], /\+ imports: c -> a/);

  fs.rmSync(path.join(root, 'modules/c/client/new.js'));
  fs.rmSync(path.join(root, 'modules/a/client/one.js'));
  assert.equal(main([], root), 1);
  assert.match(error.mock.calls.at(-1)!.arguments[0], /- imports: a -> c/);
});
