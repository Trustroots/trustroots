import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { analyze, main } from './check-package-boundaries.mts';

function makeRepo(t: TestContext, files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'package-boundaries-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeFiles(root, files);
  return root;
}

function makeRepoInsideTestsDirectory(
  t: TestContext,
  files: Record<string, string>,
): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'package-boundaries-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'tests', 'fixture');
  writeFiles(root, files);
  return root;
}

function writeFiles(root: string, files: Record<string, string>): void {
  Object.entries(files).forEach(([name, text]) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  });
}

function manifest(
  name: string,
  dependencies: Record<string, string> = {},
  optionalDependencies: Record<string, string> = {},
  peerDependencies: Record<string, string> = {},
): string {
  return JSON.stringify({
    name: `@trustroots/${name}`,
    private: true,
    dependencies,
    optionalDependencies,
    peerDependencies,
  });
}

function violations(root: string) {
  return analyze(root).map(({ file, specifier, message }) => ({
    file: file.split(path.sep).join('/'),
    specifier,
    message,
  }));
}

test('allows a package to import its own files and external dependencies', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/src/index.ts': [
      "import own from './own.js';",
      "import external from 'date-fns';",
      "export { helper } from '@/packages/alpha/src/helper';",
      "import type { Config } from 'node:stream';",
    ].join('\n'),
    'packages/alpha/src/own.ts': 'export default 1;',
    'packages/alpha/src/helper.ts': 'export const helper = 1;',
  });

  assert.deepEqual(violations(root), []);
});

test('allows a sibling package declared in dependencies, optionalDependencies or peerDependencies', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest(
      'alpha',
      { '@trustroots/beta': 'workspace:*' },
      { '@trustroots/gamma': 'workspace:*' },
      { '@trustroots/delta': 'workspace:*' },
    ),
    'packages/alpha/src/dependencies.ts': [
      "import beta from '@trustroots/beta';",
      "export { gamma } from '@trustroots/gamma/shared';",
      "type Delta = import('@trustroots/delta/types').Delta;",
    ].join('\n'),
    'packages/alpha/src/aliases.ts': [
      "import beta from '@/packages/beta/src/index';",
      "import gamma from '../../gamma/src/index';",
      "import delta from '../../../packages/delta/src/index';",
    ].join('\n'),
    'packages/beta/package.json': manifest('beta'),
    'packages/beta/src/index.ts': 'export default 1;',
    'packages/gamma/package.json': manifest('gamma'),
    'packages/gamma/src/index.ts': 'export const gamma = 1;',
    'packages/delta/package.json': manifest('delta'),
    'packages/delta/src/index.ts': 'export const delta = 1;',
  });

  assert.deepEqual(violations(root), []);
});

test('recognises declared workspace packages with non-Trustroots names', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': JSON.stringify({
      ...JSON.parse(manifest('alpha')),
      dependencies: { '@shared/runtime': 'workspace:*' },
    }),
    'packages/alpha/src/index.ts':
      "import runtime from '@shared/runtime/subpath';",
    'packages/runtime/package.json': JSON.stringify({
      name: '@shared/runtime',
      private: true,
    }),
    'packages/runtime/src/index.ts': 'export default 1;',
  });

  assert.deepEqual(violations(root), []);
});

for (const [description, packageJson] of [
  ['missing', undefined],
  ['malformed', '{ invalid json'],
  ['nameless', JSON.stringify({ private: true })],
] as const) {
  test(`fails closed when a package with source has a ${description} manifest`, t => {
    const files: Record<string, string> = {
      'packages/alpha/src/index.ts': "import external from 'date-fns';",
    };
    if (packageJson !== undefined)
      files['packages/alpha/package.json'] = packageJson;
    const root = makeRepo(t, files);

    assert.ok(
      violations(root).some(
        ({ file, specifier }) =>
          file === 'packages/alpha/package.json' &&
          specifier === 'package.json',
      ),
    );
  });
}

test('ignores an empty package directory without a manifest', t => {
  const root = makeRepo(t, {});
  fs.mkdirSync(path.join(root, 'packages/empty'), { recursive: true });

  assert.deepEqual(violations(root), []);
});

test('reports application imports through aliases, package names and normalised relative paths', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/src/bad.ts': [
      "import client from '@/modules/core/client/api';",
      "export { route } from 'modules/core/server/routes';",
      "type Layer = import('../../../layers/shell/client/page').Layer;",
      "import config = require('../../../config/runtime');",
      "const app = import('../../../apps/web/client');",
      "const tooling = require('../../../tooling/guards/check');",
      "const configPath = require.resolve('../../../config/./runtime');",
      "import core from '@trustroots/core/server/private';",
      "import aliased from '~modules/core/server/private';",
    ].join('\n'),
    'modules/core/package.json': manifest('core'),
    'modules/core/server/routes.ts': 'export const route = 1;',
  });

  const absoluteImport = path.join(root, 'modules/core/server/routes.ts');
  fs.writeFileSync(
    path.join(root, 'packages/alpha/src/absolute.ts'),
    `import route from '${absoluteImport}';`,
  );

  const found = violations(root);
  assert.equal(found.length, 10);
  found
    .filter(({ file }) => file !== 'packages/alpha/src/absolute.ts')
    .forEach(({ file }) => assert.equal(file, 'packages/alpha/src/bad.ts'));
  assert.ok(
    found.some(
      ({ file, specifier }) =>
        file === 'packages/alpha/src/absolute.ts' &&
        specifier === absoluteImport,
    ),
  );
  [
    '@/modules/core/client/api',
    'modules/core/server/routes',
    '../../../layers/shell/client/page',
    '../../../config/runtime',
    '../../../apps/web/client',
    '../../../tooling/guards/check',
    '../../../config/./runtime',
    '@trustroots/core/server/private',
    '~modules/core/server/private',
  ].forEach(specifier =>
    assert.ok(
      found.some(violation => violation.specifier === specifier),
      `expected a violation for ${specifier}`,
    ),
  );
});

test('requires workspace:* for sibling imports regardless of their spelling', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/src/undeclared.ts': [
      "import byName from '@trustroots/beta';",
      "import byAlias from '@/packages/beta/src/index';",
      "import byRelativePath from '../../beta/src/index';",
    ].join('\n'),
    'packages/beta/package.json': manifest('beta'),
    'packages/beta/src/index.ts': 'export const value = 1;',
    'modules/broken/package.json': '{ invalid json',
  });

  const found = violations(root);
  assert.equal(found.length, 3);
  [
    '@trustroots/beta',
    '@/packages/beta/src/index',
    '../../beta/src/index',
  ].forEach(specifier =>
    assert.ok(found.some(violation => violation.specifier === specifier)),
  );
});

test('rejects non-workspace sibling declarations and unknown Trustroots package names', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha', {
      '@trustroots/beta': '1.0.0',
      '@trustroots/ghost': 'workspace:*',
    }),
    'packages/alpha/src/invalid.ts': [
      "import beta from '@trustroots/beta';",
      "import ghost from '@trustroots/ghost';",
    ].join('\n'),
    'packages/beta/package.json': manifest('beta'),
    'packages/beta/src/index.ts': 'export const value = 1;',
  });

  const found = violations(root);
  assert.equal(found.length, 2);
  assert.ok(
    found.some(violation => violation.specifier === '@trustroots/beta'),
  );
  assert.ok(
    found.some(violation => violation.specifier === '@trustroots/ghost'),
  );
});

test('recognises import, export, import type, import equals, require and literal dynamic forms', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/src/import-forms.mts': [
      "import value from '../../../config/value';",
      "export { value } from '../../../config/value';",
      "export type { Config } from '../../../config/types';",
      "type Config = import('../../../config/types').Config;",
      "import legacy = require('../../../config/legacy');",
      "const loaded = import('../../../config/dynamic');",
      "const required = require('../../../config/commonjs');",
      "const moduleRequired = module.require('../../../config/module-require');",
      "const resolved = require.resolve('../../../config/resolved');",
      'const templateImport = import(`../../../config/template-import`);',
      'const templateRequire = require(`../../../config/template-require`);',
      "const dynamic = import(`../../../config/${'${name}'}`);",
    ].join('\n'),
  });

  const found = violations(root);
  const specifiers = found.map(violation => violation.specifier);
  [
    '../../../config/value',
    '../../../config/types',
    '../../../config/legacy',
    '../../../config/dynamic',
    '../../../config/commonjs',
    '../../../config/module-require',
    '../../../config/resolved',
    '../../../config/template-import',
    '../../../config/template-require',
  ].forEach(specifier => assert.ok(specifiers.includes(specifier), specifier));
  assert.equal(
    specifiers.some(specifier => specifier.includes('${name}')),
    false,
    'an interpolated import cannot be resolved statically',
  );
});

test('ignores test paths and generated, hidden, node_modules, build and dist directories', t => {
  const files: Record<string, string> = {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/tests/integration.ts':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/__tests__/integration.tsx':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/src/file.test.ts':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/src/file.tests.tsx':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/src/file.spec.mts':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/src/file.tests.cts':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/node_modules/dependency/index.ts':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/build/generated.ts':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/dist/generated.tsx':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/.cache/generated.mts':
      "import app from '../../../modules/core/server/app';",
    'packages/alpha/src/production.ts':
      "import app from '../../../modules/core/server/app';",
  };
  const root = makeRepo(t, files);

  const found = violations(root);
  assert.deepEqual(
    found.map(({ file }) => file),
    ['packages/alpha/src/production.ts'],
  );
});

test('does not treat a repository parent directory named tests as a test path', t => {
  const root = makeRepoInsideTestsDirectory(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/src/production.ts':
      "import app from '../../../config/runtime';",
  });

  assert.deepEqual(
    violations(root).map(({ file }) => file),
    ['packages/alpha/src/production.ts'],
  );
});

test('rejects production source symlinks that point outside their package', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'modules/core/package.json': manifest('core'),
    'modules/core/server/routes.ts': 'export const route = 1;',
  });
  const sourceLink = path.join(root, 'packages/alpha/src/linked.ts');
  fs.mkdirSync(path.dirname(sourceLink), { recursive: true });
  fs.symlinkSync(path.join(root, 'modules/core/server/routes.ts'), sourceLink);
  fs.symlinkSync(
    path.join(root, 'modules/core/server/missing.ts'),
    path.join(root, 'packages/alpha/src/broken.ts'),
  );

  assert.deepEqual(
    violations(root).map(({ file, specifier }) => [file, specifier]),
    [
      ['packages/alpha/src/broken.ts', '<symlink>'],
      ['packages/alpha/src/linked.ts', '<symlink>'],
    ],
  );
});

test('resolves imports through source symlinks to the real target package', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/src/import-through-link.ts':
      "import route from './linked-server/routes';",
    'modules/core/package.json': manifest('core'),
    'modules/core/server/routes.ts': 'export const route = 1;',
  });
  const linkPath = path.join(root, 'packages/alpha/src/linked-server');
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(path.join(root, 'modules/core/server'), linkPath, 'dir');

  assert.ok(
    violations(root).some(
      ({ file, specifier }) =>
        file === 'packages/alpha/src/import-through-link.ts' &&
        specifier === './linked-server/routes',
    ),
  );
});

test('ignores symlinks inside node_modules', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'modules/core/package.json': manifest('core'),
    'modules/core/server/routes.ts': 'export const route = 1;',
  });
  const nodeModules = path.join(root, 'packages/alpha/node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(
    path.join(root, 'modules/core/server'),
    path.join(nodeModules, 'core-server'),
    'dir',
  );

  assert.deepEqual(violations(root), []);
});

test('scans supported JavaScript and TypeScript extensions', t => {
  const extensions = ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'];
  const files: Record<string, string> = {
    'packages/alpha/package.json': manifest('alpha'),
  };
  extensions.forEach(extension => {
    files[`packages/alpha/src/bad.${extension}`] =
      "import app from '../../../config/runtime';";
  });
  const root = makeRepo(t, files);

  const found = violations(root);
  assert.deepEqual(
    found.map(({ file }) => file).sort(),
    extensions.map(extension => `packages/alpha/src/bad.${extension}`).sort(),
  );
});

test('checks file URLs as filesystem imports and reports invalid file URLs', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/src/own.ts': 'export const value = 1;',
    'modules/core/value.mjs': 'export const value = 1;',
  });
  const own = pathToFileURL(path.join(root, 'packages/alpha/src/own.ts')).href;
  const application = pathToFileURL(
    path.join(root, 'modules/core/value.mjs'),
  ).href;
  const outside = pathToFileURL(path.join(root, '../outside.mjs')).href;
  fs.writeFileSync(
    path.join(root, 'packages/alpha/src/imports.ts'),
    [own, application, outside, 'file://[invalid']
      .map(specifier => `import ${JSON.stringify(specifier)};`)
      .join('\n'),
  );

  assert.deepEqual(
    violations(root)
      .map(({ specifier }) => specifier)
      .sort(),
    [application, outside, 'file://[invalid'].sort(),
  );
});

test('succeeds when the packages directory is absent', t => {
  const root = makeRepo(t, {
    'README.md': 'Fixture without shared packages.\n',
  });
  const log = t.mock.method(console, 'log', () => {});

  assert.deepEqual(analyze(root), []);
  assert.equal(main([], root), 0);
  assert.equal(log.mock.calls.length, 1);
});

test('main returns success for valid imports and reports file and import on violations', t => {
  const root = makeRepo(t, {
    'packages/alpha/package.json': manifest('alpha'),
    'packages/alpha/src/valid.ts': "import external from 'date-fns';",
  });
  const log = t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});

  assert.equal(main([], root), 0);
  assert.equal(log.mock.calls.length, 1);

  fs.writeFileSync(
    path.join(root, 'packages/alpha/src/invalid.ts'),
    "import app from '../../../config/runtime';",
  );
  assert.equal(main([], root), 1);
  const diagnostic = error.mock.calls.at(-1)?.arguments.join(' ') || '';
  assert.match(diagnostic, /packages[\\/]alpha[\\/]src[\\/]invalid\.ts/);
  assert.ok(diagnostic.includes('../../../config/runtime'));
});
