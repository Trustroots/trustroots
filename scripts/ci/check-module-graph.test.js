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
