const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');

// Shared source and stylesheet paths for client tooling.
const aliases = {
  '@': root,
  img: resolve(root, 'public/img'),
  less: resolve(root, 'modules/core/client/less'),
  modules: resolve(root, 'modules'),
};

// Preserve the CommonJS entries expected by the existing client dependencies.
const commonJsAliases = {
  'nostr-tools/relay': require.resolve('nostr-tools/relay'),
  'nostr-tools/nip19': require.resolve('nostr-tools/nip19'),
  'tiny-warning': require.resolve('tiny-warning'),
};

const browserFallbacks = {
  querystring: require.resolve('querystring-es3'),
  url: require.resolve('url/'),
};

module.exports = { aliases, commonJsAliases, browserFallbacks };
