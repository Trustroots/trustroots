const compact = require('lodash/compact');

const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        corejs: '3.49',
        modules: 'commonjs',
        useBuiltIns: 'usage',
      },
    ],
    ['@babel/preset-react'],
    ['@babel/preset-typescript'],
  ],
  plugins: compact([
    // Transpile class fields consistently regardless of browser targets.
    '@babel/plugin-transform-class-properties',
    isDevelopment && 'react-refresh/babel',
  ]),
};
