const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');

// Shared source and stylesheet paths for client tooling.
const aliases = {
  '@': root,
  img: resolve(root, 'public/img'),
  less: resolve(root, 'modules/core/client/less'),
  modules: resolve(root, 'modules'),
};

// Try the written `.js` specifier before the migrated TypeScript file so
// Webpack and ESLint select the same file when both exist. Vite applies this
// order in its own resolver: the exact `.js` file, then `.ts`, then `.tsx`.
const jsExtensionAlias = ['.js', '.ts', '.tsx'];

// unrs-resolver stores each alias as a list of paths.
function resolverAliases() {
  return Object.fromEntries(
    Object.entries(aliases).map(([name, filename]) => [name, [filename]]),
  );
}

let commonJsAliases;
let browserFallbacks;

function loadCommonJsAliases() {
  // Preserve the CommonJS entries expected by the existing client dependencies.
  return {
    'nostr-tools/relay': require.resolve('nostr-tools/relay'),
    'nostr-tools/nip19': require.resolve('nostr-tools/nip19'),
    'tiny-warning': require.resolve('tiny-warning'),
  };
}

function loadBrowserFallbacks() {
  return {
    querystring: require.resolve('querystring-es3'),
    url: require.resolve('url/'),
  };
}

module.exports = {
  aliases,
  jsExtensionAlias,
  resolverAliases,
  // ESLint only needs the source aliases. Resolve package entry files when a
  // bundler reads these, so loading the lint config does not depend on them.
  get commonJsAliases() {
    commonJsAliases ??= loadCommonJsAliases();
    return commonJsAliases;
  },
  get browserFallbacks() {
    browserFallbacks ??= loadBrowserFallbacks();
    return browserFallbacks;
  },
};
