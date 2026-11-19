import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { before, test } from 'node:test';
import { ESLint } from 'eslint';
import aliasesConfig from './aliases.mts';

const require = createRequire(import.meta.url);
const { resolve: resolveImport } = require('eslint-import-resolver-typescript');
const { commonJsAliases, resolverAliases } = aliasesConfig;

const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root });
const filePath = fileURLToPath(
  new URL('./resolution-probe.ts', import.meta.url),
);

const resolvedFiles = [
  ['@/layers/shell/client/ReactApp', 'layers/shell/client/ReactApp.tsx'],
  ['./i18n', 'config/client/i18n.ts'],
  [
    '@/modules/support/shared/volunteering-copy.ts',
    'modules/support/shared/volunteering-copy.ts',
  ],
];

let resolverOptions;

before(async () => {
  const config = await eslint.calculateConfigForFile(
    resolve(root, 'config/client/i18n.ts'),
  );
  resolverOptions = config.settings['import/resolver'].typescript;
  assert.ok(resolverOptions, 'TypeScript import resolver is not configured');
  assert.deepEqual(resolverOptions.alias, resolverAliases());
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

test('ESLint resolves source aliases and package exports', async () => {
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
    "import '@/missing-client-module';\n",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /missing-client-module/);

  const result = resolveImport(
    '@/missing-client-module',
    filePath,
    resolverOptions,
  );
  assert.equal(result.found, false);
});

test('bundler package aliases are real CommonJS entry files', () => {
  for (const filename of Object.values(commonJsAliases)) {
    assert.equal(existsSync(filename), true, filename);
    assert.equal(dirname(filename).includes('node_modules'), true, filename);
  }
});
