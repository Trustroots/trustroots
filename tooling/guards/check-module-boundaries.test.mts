import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { analyze, main } from './check-module-boundaries.mts';

function makeRepo(t: TestContext, files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'module-boundaries-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return root;
}

function write(root: string, name: string, text: string): string {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

function manifest(name: string): string {
  return JSON.stringify({ name, private: true });
}

test('allows modules, packages, config, externals and near-prefix names', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/client/allowed.cts': [
      "import feature from '@trustroots/b/client/feature';",
      "import shared from '@trustroots/logger';",
      "import config from '@/config/config';",
      "import external from 'layers-helper';",
      "import similarLayerPrefix from 'layers-extra/shell/client';",
      "import similarAppPrefix from 'apps-old/web/client';",
      "import similarLayerPath from '@/layers-extra/shell/client';",
      "// import fake from '@/layers/shell/client/screen';",
      `const textOnly = "require('apps/web/client/entry')";`,
      'const interpolated = import(`apps/${name}/client/entry`);',
    ].join('\n'),
    'modules/b/package.json': manifest('@trustroots/b'),
    'modules/b/client/feature.ts': 'export default 1;',
    'packages/logger/package.json': manifest('@trustroots/logger'),
    'layers/shell/package.json': manifest('@trustroots/shell'),
    'layers/shell/client/composition.ts':
      "import feature from '@trustroots/a/client/entry';",
    'apps/web/package.json': manifest('@trustroots/web-app'),
    'apps/web/client/composition.ts':
      "import feature from '@trustroots/a/client/entry';",
  });

  assert.deepEqual(analyze(root), []);
});

test('rejects production layer imports into apps and ignores layer tests', t => {
  const root = makeRepo(t, {
    'layers/shell/package.json': manifest('@trustroots/shell'),
    'layers/shell/client/entry.ts': [
      "import app from '@trustroots/web-app/client/entry';",
      "export { value } from '@/apps/web/client/entry';",
      "const relative = require('../../../apps/web/client/entry');",
      "import config from '@/config/config';",
      "import feature from '@trustroots/core/client/entry';",
      "import external from 'some-library';",
    ].join('\n'),
    'layers/shell/tests/app.tests.ts':
      "import app from '@trustroots/web-app/client/entry';",
    'apps/web/package.json': manifest('@trustroots/web-app'),
    'apps/web/client/entry.ts': 'export const entry = 1;',
    'modules/core/package.json': manifest('@trustroots/core'),
    'modules/core/client/entry.ts': 'export const value = 1;',
    'config/config.ts': 'export default {};',
  });

  const violations = analyze(root);
  assert.deepEqual(
    violations.map(({ file, specifier }) => [file, specifier]),
    [
      ['layers/shell/client/entry.ts', '@trustroots/web-app/client/entry'],
      ['layers/shell/client/entry.ts', '@/apps/web/client/entry'],
      ['layers/shell/client/entry.ts', '../../../apps/web/client/entry'],
    ].sort((a, b) => a[1].localeCompare(b[1])),
  );
});

test('rejects layer and app imports by package name, alias, root path, relative path and file URL', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'layers/shell/package.json': manifest('@trustroots/shell'),
    'layers/shell/client/screen.tsx': 'export default function Screen() {}',
    'apps/web/package.json': manifest('@trustroots/web-app'),
    'apps/web/client/entry.ts': 'export const entry = 1;',
    'layers/editor/package.json': manifest('@community/editor-shell'),
    'layers/editor/client/entry.ts': 'export const entry = 1;',
  });
  const relativeLayer = '../../../layers/shell/client/screen';
  const dottedLayer = '../../../layers/shell/client/./screen/../screen';
  const fileUrl = pathToFileURL(
    path.join(root, 'apps/web/client/entry.ts'),
  ).href;
  const source = [
    "import namedLayer from '@trustroots/shell/client/screen';",
    "import namedApp from '@trustroots/web-app/client/entry';",
    "import customNamespace from '@community/editor-shell/client/entry';",
    "export { entry } from '@/layers/shell/client/screen';",
    "import type { Screen } from '@/layers/shell/client/screen';",
    "export type { Screen } from '@/layers/shell/client/screen';",
    "export { entry as aliasedApp } from '@/apps/web/client/entry';",
    "const app = require('apps/web/client/entry');",
    `type Entry = import('${fileUrl}').Entry;`,
    `const relative = import('${relativeLayer}');`,
    `const dotted = require('${dottedLayer}');`,
    "const resolved = require.resolve('layers/shell/client/screen');",
    "const moduleRequired = module.require('apps/web/client/entry');",
    "import Legacy = require('layers/shell/client/screen');",
    'const template = import(`apps/web/client/entry`);',
    'const templateRequired = module.require(`apps/web/client/entry`);',
  ].join('\n');
  write(root, 'modules/a/client/entry.tsx', source);

  assert.deepEqual(
    analyze(root)
      .map(({ specifier }) => specifier)
      .sort(),
    [
      '@trustroots/shell/client/screen',
      '@trustroots/web-app/client/entry',
      '@community/editor-shell/client/entry',
      '@/layers/shell/client/screen',
      '@/layers/shell/client/screen',
      '@/layers/shell/client/screen',
      '@/apps/web/client/entry',
      'apps/web/client/entry',
      fileUrl,
      relativeLayer,
      dottedLayer,
      'layers/shell/client/screen',
      'apps/web/client/entry',
      'layers/shell/client/screen',
      'apps/web/client/entry',
      'apps/web/client/entry',
    ].sort(),
  );
});

test('canonical path resolution catches layer imports through symlinks', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'layers/shell/package.json': manifest('@trustroots/shell'),
    'layers/shell/client/entry.ts': 'export const entry = 1;',
  });
  const moduleDir = path.join(root, 'modules/a/client');
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.symlinkSync(
    path.join(root, 'layers/shell'),
    path.join(moduleDir, 'shared-layer'),
  );
  write(
    root,
    'modules/a/client/import.ts',
    "import layer from './shared-layer/client/entry';",
  );

  const specifiers = analyze(root).map(({ specifier }) => specifier);
  assert.ok(specifiers.includes('./shared-layer/client/entry'));
  assert.ok(specifiers.includes('<symlink>'));
});

test('rejects layer and app aliases whose targets are symlinked outside the repo', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/client/entry.ts': [
      "import layer from '@/layers/shell/client/entry';",
      "import app from '@/apps/web/client/entry';",
    ].join('\n'),
  });
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), 'module-boundary-targets-'),
  );
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  write(external, 'shell/client/entry.ts', 'export const layer = 1;');
  write(external, 'web/client/entry.ts', 'export const app = 1;');
  fs.mkdirSync(path.join(root, 'layers'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps'), { recursive: true });
  fs.symlinkSync(path.join(external, 'shell'), path.join(root, 'layers/shell'));
  fs.symlinkSync(path.join(external, 'web'), path.join(root, 'apps/web'));

  const specifiers = analyze(root).map(({ specifier }) => specifier);
  assert.ok(specifiers.includes('@/layers/shell/client/entry'));
  assert.ok(specifiers.includes('@/apps/web/client/entry'));
});

test('ignores node_modules symlinks even when their targets contain layer source', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/client/entry.ts': 'export const value = 1;',
  });
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), 'module-boundary-dependency-'),
  );
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  write(external, 'client/entry.ts', 'export const value = 1;');
  const nodeModules = path.join(root, 'modules/a/client/node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(
    path.join(external, 'client'),
    path.join(nodeModules, 'layer'),
  );

  assert.deepEqual(analyze(root), []);
});

test('rejects unknown names in the repository package namespace', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/client/entry.ts': "import missing from '@trustroots/unknown';",
  });

  assert.deepEqual(
    analyze(root).map(({ specifier }) => specifier),
    ['@trustroots/unknown'],
  );
});

test('does not skip modules with malformed manifests and rejects source symlinks', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': '{ malformed',
    'modules/b/client/entry.ts':
      "import layer from '@/layers/shell/client/entry';",
    'layers/shell/package.json': manifest('@trustroots/shell'),
    'layers/shell/client/entry.ts': 'export const entry = 1;',
  });
  const moduleDir = path.join(root, 'modules/a/client');
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.symlinkSync(
    path.join(root, 'layers/shell/client/entry.ts'),
    path.join(moduleDir, 'linked.ts'),
  );
  write(
    root,
    'modules/a/shared/also.ts',
    "import layer from '@trustroots/shell/client/entry';",
  );

  const violations = analyze(root);
  assert.ok(violations.some(v => v.specifier === '<symlink>'));
  assert.ok(
    violations.some(v => v.specifier === '@trustroots/shell/client/entry'),
  );
  assert.ok(
    violations.some(
      v =>
        v.file === 'modules/b/client/entry.ts' &&
        v.specifier === '@/layers/shell/client/entry',
    ),
  );
});

test('ignores module tests and generated source directories', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'layers/shell/package.json': manifest('@trustroots/shell'),
    'modules/a/tests/client/import.tests.ts':
      "import shell from '@trustroots/shell';",
    'modules/a/tests/client/import.test.ts':
      "import shell from '@trustroots/shell';",
    'modules/a/tests/client/import.spec.tsx':
      "import shell from '@trustroots/shell';",
    'modules/a/client/__tests__/import.ts':
      "import shell from '@trustroots/shell';",
    'modules/a/client/import.test.ts': "import shell from '@trustroots/shell';",
    'modules/a/client/import.tests.ts':
      "import shell from '@trustroots/shell';",
    'modules/a/client/import.spec.tsx':
      "import shell from '@trustroots/shell';",
    'modules/a/client/dist/import.ts': "import shell from '@trustroots/shell';",
  });

  assert.deepEqual(analyze(root), []);
});

test('rejects a symlinked top-level module that contains production source', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/client/entry.ts': "import layer from '@/layers/shell/entry';",
    'layers/shell/entry.ts': 'export const value = 1;',
  });
  fs.symlinkSync(
    path.join(root, 'modules/a'),
    path.join(root, 'modules/alias'),
    'dir',
  );

  assert.ok(
    analyze(root).some(
      ({ file, specifier }) =>
        file === 'modules/alias' && specifier === '<symlink>',
    ),
  );
});

test('ignores tests symlinks even when their targets contain application code', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'modules/a/client/entry.ts': 'export const value = 1;',
    'layers/shell/client/entry.ts':
      "import feature from '@trustroots/a/client/entry';",
  });
  fs.symlinkSync(
    path.join(root, 'layers/shell'),
    path.join(root, 'modules/a/client/tests'),
    'dir',
  );

  assert.deepEqual(analyze(root), []);
});

test('main reports stable file and import diagnostics', t => {
  const root = makeRepo(t, {
    'modules/a/package.json': manifest('@trustroots/a'),
    'layers/shell/package.json': manifest('@trustroots/shell'),
    'modules/a/client/entry.ts':
      "import shell from '@/layers/shell/client/entry';",
  });
  const originalError = console.error;
  let diagnostic = '';
  console.error = message => {
    diagnostic += String(message);
  };
  try {
    assert.equal(main([], root), 1);
  } finally {
    console.error = originalError;
  }
  assert.match(diagnostic, /modules\/a\/client\/entry\.ts/);
  assert.match(diagnostic, /@\/layers\/shell\/client\/entry/);
});

test('an absent modules directory passes and reports a clean result', t => {
  const root = makeRepo(t, {});
  const originalLog = console.log;
  let output = '';
  console.log = message => {
    output += String(message);
  };
  try {
    assert.equal(main([], root), 0);
  } finally {
    console.log = originalLog;
  }
  assert.match(output, /Layer and feature module boundaries are satisfied/);
});
