const compact = require('lodash/compact');

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
    // Always transpile class fields: webpack 4's parser cannot handle the
    // syntax, so preset-env must not skip them based on browser targets.
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-optional-chaining',
    'angularjs-annotate',
    isDevelopment && 'react-refresh/babel',
  ]),
};
