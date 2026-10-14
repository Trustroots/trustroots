import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();
const filePath = fileURLToPath(
  new URL('./resolution-probe.ts', import.meta.url),
);

async function unresolvedImports(source) {
  const [result] = await eslint.lintText(source, { filePath });
  assert.equal(result.fatalErrorCount, 0);
  return result.messages.filter(
    message => message.ruleId === 'import/no-unresolved',
  );
}

test('ESLint resolves source aliases, migrated .js imports and package exports', async () => {
  assert.deepEqual(
    await unresolvedImports(
      [
        "import '@/modules/core/client/react-app/ReactApp.js';",
        "import 'modules/messages/client/services/visibility.client.service.js';",
        "import './i18n.js';",
        "import 'nostr-tools/relay';",
        "import 'node:path';",
        '',
      ].join('\n'),
    ),
    [],
  );
});

test('ESLint still rejects an unresolved aliased import', async () => {
  const messages = await unresolvedImports(
    "import '@/missing-client-module.js';\n",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /missing-client-module/);
});
