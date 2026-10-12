const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  analyze,
  diffGraphs,
  findCycles,
  main,
} = require('./check-module-graph');

function makeRepo(files) {
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

test('records cross-module imports in .mts source files', () => {
  const root = makeRepo({
    'modules/a/shared/one.mts':
      "import type { Value } from '@/modules/b/shared/value.mts';",
    'modules/b/shared/value.mts': 'export type Value = string;',
  });
  assert.deepEqual(analyze(root), { imports: { a: ['b'] }, models: {} });
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
  t.mock.method(console, 'error', () => {});
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
  assert.match(
    console.error.mock.calls.at(-1).arguments[0],
    /\+ imports: c -> a/,
  );

  fs.rmSync(path.join(root, 'modules/c/client/new.js'));
  fs.rmSync(path.join(root, 'modules/a/client/one.js'));
  assert.equal(main([], root), 1);
  assert.match(
    console.error.mock.calls.at(-1).arguments[0],
    /- imports: a -> c/,
  );
});
