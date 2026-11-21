import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const root = resolve(__dirname, '../..');

// Shared source and stylesheet paths for client tooling.
const aliases = {
  '@': root,
  img: resolve(root, 'public/img'),
  less: resolve(root, 'modules/core/client/less'),
  modules: resolve(root, 'modules'),
};

let commonJsAliases;

function loadCommonJsAliases() {
  // Preserve the CommonJS entries expected by the existing client dependencies.
  return {
    'nostr-tools/relay': require.resolve('nostr-tools/relay'),
    'nostr-tools/nip19': require.resolve('nostr-tools/nip19'),
  };
}

const aliasesConfig = {
  aliases,
  // Resolve package entry files only when a bundler reads these.
  get commonJsAliases() {
    commonJsAliases ??= loadCommonJsAliases();
    return commonJsAliases;
  },
};

export default aliasesConfig;
