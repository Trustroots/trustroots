import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { before, test } from 'node:test';
import { ESLint } from 'eslint';

const require = createRequire(import.meta.url);
const { resolve: resolveImport } = require('eslint-import-resolver-typescript');
const {
  browserFallbacks,
  commonJsAliases,
  jsExtensionAlias,
  resolverAliases,
} = require('./aliases.cjs');

const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root });
const filePath = fileURLToPath(
  new URL('./resolution-probe.ts', import.meta.url),
);

const resolvedFiles = [
  [
    '@/modules/core/client/react-app/ReactApp.js',
    'modules/core/client/react-app/ReactApp.tsx',
  ],
  [
    'modules/messages/client/services/visibility.client.service.js',
    'modules/messages/client/services/visibility.client.service.ts',
  ],
  ['./i18n.js', 'config/client/i18n.js'],
  [
    '@/modules/support/shared/volunteering-copy.ts',
    'modules/support/shared/volunteering-copy.ts',
  ],
];

let resolverOptions;

before(async () => {
  const config = await eslint.calculateConfigForFile(
    resolve(root, 'config/client/i18n.js'),
  );
  resolverOptions = config.settings['import/resolver'].typescript;
  assert.ok(resolverOptions, 'TypeScript import resolver is not configured');
  assert.deepEqual(resolverOptions.alias, resolverAliases());
  assert.deepEqual(resolverOptions.extensionAlias['.js'].slice(0, 3), [
    '.js',
    '.ts',
    '.tsx',
  ]);
  assert.ok(resolverOptions.extensionAlias['.js'].includes('.d.ts'));
  for (const extension of ['.jsx', '.ts', '.tsx', '.mjs', '.cjs']) {
    assert.ok(
      resolverOptions.extensionAlias[extension]?.length,
      `extensionAlias lost the ${extension} mapping`,
    );
  }
});

function resolvedPath(source) {
  const result = resolveImport(source, filePath, resolverOptions);
  assert.equal(result.found, true, `${source} did not resolve`);
  return result.path;
}

async function unresolvedImports(source) {
  const [result] = await eslint.lintText(source, { filePath });
  assert.equal(result.fatalErrorCount, 0);
  return result.messages.filter(
    message => message.ruleId === 'import/no-unresolved',
  );
}

test('ESLint resolves client imports to the migrated source files', () => {
  for (const [source, suffix] of resolvedFiles) {
    const resolved = resolvedPath(source);
    assert.equal(
      resolved.endsWith(suffix),
      true,
      `${source} resolved to ${resolved}`,
    );
  }

  const relay = resolvedPath('nostr-tools/relay');
  assert.equal(existsSync(relay), true);
  assert.match(relay, /nostr-tools/);
});

test('ESLint resolves source aliases, migrated .js imports and package exports', async () => {
  const messages = await unresolvedImports(
    [
      ...resolvedFiles.map(([source]) => `import '${source}';`),
      "import 'nostr-tools/relay';",
      "import 'node:path';",
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    messages,
    [],
    messages.map(message => message.message).join('\n'),
  );
});

test('ESLint still rejects an unresolved aliased import', async () => {
  const messages = await unresolvedImports(
    "import '@/missing-client-module.js';\n",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /missing-client-module/);

  const result = resolveImport(
    '@/missing-client-module.js',
    filePath,
    resolverOptions,
  );
  assert.equal(result.found, false);
});

test('bundler package aliases are real CommonJS entry files', () => {
  assert.deepEqual(jsExtensionAlias, ['.js', '.ts', '.tsx']);
  for (const filename of [
    ...Object.values(commonJsAliases),
    ...Object.values(browserFallbacks),
  ]) {
    assert.equal(existsSync(filename), true, filename);
    assert.equal(dirname(filename).includes('node_modules'), true, filename);
  }
});
