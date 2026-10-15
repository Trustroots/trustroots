import type { BabelConfiguration } from './config/build-tool-types.mjs';

const babelConfig: BabelConfiguration = {
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
  plugins: [
    // Transpile class fields consistently regardless of browser targets.
    '@babel/plugin-transform-class-properties',
  ],
};

module.exports = babelConfig;
