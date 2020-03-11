const compact = require('lodash/compact');
const path = require('path');
const locales = require(path.resolve('./config/shared/locales'));

const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        corejs: 2,
        modules: 'commonjs',
        useBuiltIns: 'usage',
      },
    ],
    ['@babel/preset-react'],
  ],
  plugins: compact([
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-optional-chaining',
    'angularjs-annotate',
    isDevelopment && 'react-refresh/babel',
    [
      'i18next-extract',
      {
        nsSeparator: false,
        locales: locales.map(locale => locale.code),
        keySeparator: false,
        outputPath: 'public/locales/{{locale}}/{{ns}}.json',
        keyAsDefaultValue: ['en'],
        discardOldKeys: true,
      },
    ],
  ]),
};
