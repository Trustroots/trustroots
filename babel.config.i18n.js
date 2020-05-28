const path = require('path');
const locales = require(path.resolve('./config/shared/locales'));

const config = require('./babel.config');

config.plugins.push([
  // extraction of the i18next translation strings
  'i18next-extract',
  {
    nsSeparator: false,
    locales: locales.map(locale => locale.code),
    keySeparator: false,
    outputPath: 'public/locales/{{locale}}/{{ns}}.json',
    keyAsDefaultValue: ['en'],
    discardOldKeys: true,
  },
]);

module.exports = config;
