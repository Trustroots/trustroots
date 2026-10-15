import type { BabelConfiguration } from './config/build-tool-types.mjs';

const config = require('./babel.config.cts') as BabelConfiguration;

config.plugins.push([
  // extraction of the i18next translation strings
  'i18next-extract',
  {
    nsSeparator: false,
    locales: ['en'], // only extract for source language
    keySeparator: false,
    outputPath: 'public/locales/{{locale}}/{{ns}}.json',
    keyAsDefaultValue: ['en'],
    discardOldKeys: true,
  },
]);

module.exports = config;
